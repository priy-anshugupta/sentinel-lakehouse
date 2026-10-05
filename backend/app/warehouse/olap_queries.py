import duckdb
import time
import pandas as pd
from typing import Tuple, List, Dict, Any, Optional

# PaySim steps represent simulated hours. A month here is a fixed 30-day
# simulation bucket, not a calendar month.
TIME_EXPRESSIONS = {
    'HOUR': 'dt.hour_of_day',
    'DAY': 'dt.day_number',
    'WEEK': 'dt.week_number',
    'MONTH': 'CAST(FLOOR((ft.step_number - 1) / 720) AS INTEGER) + 1',
}

def _execute_timed(con: duckdb.DuckDBPyConnection, sql: str, params: tuple = ()) -> Tuple[List[Dict[str, Any]], str, float]:
    start_time = time.time()
    if params:
        result = con.execute(sql, params).fetchdf()
    else:
        result = con.execute(sql).fetchdf()
    end_time = time.time()
    exec_ms = (end_time - start_time) * 1000
    
    result = result.astype(object).where(pd.notnull(result), None)
    return result.to_dict(orient='records'), sql, exec_ms

def rollup_query(con: duckdb.DuckDBPyConnection, granularity: str, type_filter: Optional[str] = None, fraud_only: bool = False, is_night: Optional[bool] = None, step_start: Optional[int] = None, step_end: Optional[int] = None) -> Tuple[List[Dict[str, Any]], str, float]:
    time_expr = TIME_EXPRESSIONS[granularity]
    
    sql = f"""
        SELECT 
            {time_expr} as period,
            COUNT(*) as tx_count,
            SUM(ft.amount) as total_amount,
            AVG(ft.amount) as avg_amount,
            COALESCE(SUM(ft.is_fraud_actual),0) as fraud_count,
            COUNT(ft.is_fraud_actual) as labelled_count
        FROM fact_transactions ft
        JOIN dim_time dt ON ft.time_key = dt.time_key
        JOIN dim_transaction_type dtt ON ft.type_key = dtt.type_key
        WHERE 1=1
    """
    params = []
    
    if type_filter:
        sql += " AND dtt.type_name = ?"
        params.append(type_filter)
    if fraud_only:
        sql += " AND ft.is_fraud_actual = 1"
    if is_night is not None:
        sql += " AND dt.is_night = ?"
        params.append(is_night)
    if step_start is not None:
        sql += " AND ft.step_number >= ?"
        params.append(step_start)
    if step_end is not None:
        sql += " AND ft.step_number <= ?"
        params.append(step_end)
        
    sql += f" GROUP BY {time_expr} ORDER BY {time_expr}"
    
    return _execute_timed(con, sql, tuple(params))

def drilldown_query(con: duckdb.DuckDBPyConnection, parent_value: int, parent_granularity: str, type_filter: Optional[str] = None, fraud_only: bool = False, is_night: Optional[bool] = None, scope_start=None, scope_end=None) -> Tuple[List[Dict[str, Any]], str, float]:
    # 30-day months are not composed of whole 7-day weeks.
    hierarchy = {'MONTH': 'DAY', 'WEEK': 'DAY', 'DAY': 'HOUR'}
    if parent_granularity not in hierarchy:
        raise ValueError('Hour is the deepest supported drill-down level')
    child_expr = TIME_EXPRESSIONS[hierarchy[parent_granularity]]
    parent_expr = TIME_EXPRESSIONS[parent_granularity]
        
    sql = f"""
        SELECT 
            {child_expr} as child_period,
            COUNT(*) as tx_count,
            SUM(ft.amount) as total_amount,
            COALESCE(SUM(ft.is_fraud_actual),0) as fraud_count,
            COUNT(ft.is_fraud_actual) as labelled_count
        FROM fact_transactions ft
        JOIN dim_time dt ON ft.time_key = dt.time_key
        JOIN dim_transaction_type dtt ON ft.type_key = dtt.type_key
        WHERE {parent_expr} = ?
    """
    params = [parent_value]
    
    if type_filter:
        sql += " AND dtt.type_name = ?"
        params.append(type_filter)
    if fraud_only:
        sql += " AND ft.is_fraud_actual = 1"
    if is_night is not None:
        sql += " AND dt.is_night = ?"
        params.append(is_night)
        
    if scope_start is not None:
        sql += ' AND ft.step_number >= ?'
        params.append(scope_start)
    if scope_end is not None:
        sql += ' AND ft.step_number <= ?'
        params.append(scope_end)
    sql += f" GROUP BY {child_expr} ORDER BY {child_expr}"
    
    return _execute_timed(con, sql, tuple(params))

def slice_query(con: duckdb.DuckDBPyConnection, dimension: str, value: Any, granularity: str) -> Tuple[List[Dict[str, Any]], str, float]:
    time_expr = TIME_EXPRESSIONS[granularity]
    
    sql = f"""
        SELECT 
            {time_expr} as period,
            COUNT(*) as tx_count,
            SUM(ft.amount) as total_amount,
            COALESCE(SUM(ft.is_fraud_actual),0) as fraud_count,
            COUNT(ft.is_fraud_actual) as labelled_count
        FROM fact_transactions ft
        JOIN dim_time dt ON ft.time_key = dt.time_key
        JOIN dim_transaction_type dtt ON ft.type_key = dtt.type_key
        JOIN dim_account da_orig ON ft.orig_acc_key = da_orig.acc_key
    """
    
    params = [value]
    if dimension == 'type':
        sql += " WHERE dtt.type_name = ?"
    elif dimension == 'account_type':
        sql += " WHERE da_orig.account_type = ?"
    elif dimension == 'risk_tier':
        sql += " WHERE da_orig.risk_tier = ?"
    else:
        sql += " WHERE 1=0" 
        
    sql += f" GROUP BY {time_expr} ORDER BY {time_expr}"
    return _execute_timed(con, sql, tuple(params))

def dice_query(con: duckdb.DuckDBPyConnection, type_filter_list: List[str], fraud_only: bool, is_night: Optional[bool], step_start: Optional[int], step_end: Optional[int], granularity: str) -> Tuple[List[Dict[str, Any]], str, float]:
    time_expr = TIME_EXPRESSIONS[granularity]
    
    sql = f"""
        SELECT 
            {time_expr} as period,
            dtt.type_name,
            COUNT(*) as tx_count,
            SUM(ft.amount) as total_amount,
            COALESCE(SUM(ft.is_fraud_actual),0) as fraud_count,
            COUNT(ft.is_fraud_actual) as labelled_count
        FROM fact_transactions ft
        JOIN dim_time dt ON ft.time_key = dt.time_key
        JOIN dim_transaction_type dtt ON ft.type_key = dtt.type_key
        WHERE 1=1
    """
    params = []
    
    if type_filter_list:
        placeholders = ','.join(['?'] * len(type_filter_list))
        sql += f" AND dtt.type_name IN ({placeholders})"
        params.extend(type_filter_list)
        
    if fraud_only:
        sql += " AND ft.is_fraud_actual = 1"
        
    if is_night is not None:
        sql += " AND dt.is_night = ?"
        params.append(is_night)
        
    if step_start is not None:
        sql += " AND ft.step_number >= ?"
        params.append(step_start)
        
    if step_end is not None:
        sql += " AND ft.step_number <= ?"
        params.append(step_end)
        
    sql += f" GROUP BY {time_expr}, dtt.type_name ORDER BY {time_expr}, dtt.type_name"
    return _execute_timed(con, sql, tuple(params))

def pivot_query(con: duckdb.DuckDBPyConnection, row_dim: str = 'day_of_week', col_dim: str = 'type_name', measure: str = 'amount', type_filter=None, is_night=None, fraud_only=False, step_start=None, step_end=None):
    dimensions = {'day_of_week':'dt.day_of_week', 'day_number':'dt.day_number', 'week_number':'dt.week_number',
        'month_number':TIME_EXPRESSIONS['MONTH'], 'hour_of_day':'dt.hour_of_day',
        'type_name':'dtt.type_name', 'period_of_day':'dt.period_of_day'}
    measures = {'amount':'SUM(amount)', 'sum_amount':'SUM(amount)', 'total_amount':'SUM(amount)',
        'tx_count':'COUNT(tx_id)', 'count':'COUNT(tx_id)', 'fraud_count':'SUM(confirmed)'}
    if row_dim not in dimensions or col_dim not in dimensions or measure not in measures:
        raise ValueError('Unsupported pivot dimension or measure')
    columns = {'type_name': ['PAYMENT','TRANSFER','CASH_OUT','DEBIT','CASH_IN'],
               'period_of_day': ['Night','Morning','Afternoon','Evening'],
               'day_of_week': ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']}
    if col_dim not in columns:
        raise ValueError('Pivot columns must be transaction type, time of day or weekday cycle')
    column_values = ','.join("'"+value+"'" for value in columns[col_dim])
    row_expr, col_expr, measure_expr = dimensions[row_dim], dimensions[col_dim], measures[measure]
    filters, params = ['1=1'], []
    for expression, value in [('dtt.type_name = ?',type_filter), ('dt.is_night = ?',is_night),
                              ('ft.step_number >= ?',step_start), ('ft.step_number <= ?',step_end)]:
        if value is not None:
            filters.append(expression)
            params.append(value)
    if fraud_only:
        filters.append('ft.is_fraud_actual = 1')
    
    sql = f"""
        PIVOT (
            SELECT 
                {row_expr} AS row_label,
                {col_expr} AS col_label,
                ft.tx_id,
                ft.amount, coalesce(ft.is_fraud_actual,0) AS confirmed
            FROM fact_transactions ft
            JOIN dim_time dt ON ft.time_key = dt.time_key
            JOIN dim_transaction_type dtt ON ft.type_key = dtt.type_key
            WHERE {' AND '.join(filters)}
        )
        ON col_label IN ({column_values}) USING {measure_expr}
        GROUP BY row_label ORDER BY row_label
    """
    
    return _execute_timed(con, sql, tuple(params))
