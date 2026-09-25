import duckdb
import time
from typing import Tuple, List, Dict, Any, Optional

def _execute_timed(con: duckdb.DuckDBPyConnection, sql: str, params: tuple = ()) -> Tuple[List[Dict[str, Any]], str, float]:
    start_time = time.time()
    if params:
        result = con.execute(sql, params).fetchdf()
    else:
        result = con.execute(sql).fetchdf()
    end_time = time.time()
    exec_ms = (end_time - start_time) * 1000
    
    return result.to_dict(orient='records'), sql, exec_ms

def rollup_query(con: duckdb.DuckDBPyConnection, granularity: str, type_filter: Optional[str] = None, fraud_only: bool = False, is_night: Optional[bool] = None) -> Tuple[List[Dict[str, Any]], str, float]:
    time_col = 'day_number' if granularity == 'DAY' else 'week_number' if granularity == 'WEEK' else 'hour_of_day'
    
    sql = f"""
        SELECT 
            dt.{time_col} as period,
            COUNT(*) as tx_count,
            SUM(ft.amount) as total_amount,
            AVG(ft.amount) as avg_amount,
            SUM(ft.is_fraud_actual) as fraud_count
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
        
    sql += f" GROUP BY dt.{time_col} ORDER BY dt.{time_col}"
    
    return _execute_timed(con, sql, tuple(params))

def drilldown_query(con: duckdb.DuckDBPyConnection, parent_value: int, parent_granularity: str, type_filter: Optional[str] = None, fraud_only: bool = False) -> Tuple[List[Dict[str, Any]], str, float]:
    if parent_granularity == 'WEEK':
        child_col = 'day_number'
        parent_col = 'week_number'
    elif parent_granularity == 'DAY':
        child_col = 'hour_of_day'
        parent_col = 'day_number'
    else:
        child_col = 'step'
        parent_col = 'hour_of_day'
        
    sql = f"""
        SELECT 
            dt.{child_col} as child_period,
            COUNT(*) as tx_count,
            SUM(ft.amount) as total_amount
        FROM fact_transactions ft
        JOIN dim_time dt ON ft.time_key = dt.time_key
        JOIN dim_transaction_type dtt ON ft.type_key = dtt.type_key
        WHERE dt.{parent_col} = ?
    """
    params = [parent_value]
    
    if type_filter:
        sql += " AND dtt.type_name = ?"
        params.append(type_filter)
    if fraud_only:
        sql += " AND ft.is_fraud_actual = 1"
        
    sql += f" GROUP BY dt.{child_col} ORDER BY dt.{child_col}"
    
    return _execute_timed(con, sql, tuple(params))

def slice_query(con: duckdb.DuckDBPyConnection, dimension: str, value: Any, granularity: str) -> Tuple[List[Dict[str, Any]], str, float]:
    time_col = 'day_number' if granularity == 'DAY' else 'week_number' if granularity == 'WEEK' else 'hour_of_day'
    
    sql = f"""
        SELECT 
            dt.{time_col} as period,
            COUNT(*) as tx_count,
            SUM(ft.amount) as total_amount
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
        
    sql += f" GROUP BY dt.{time_col} ORDER BY dt.{time_col}"
    return _execute_timed(con, sql, tuple(params))

def dice_query(con: duckdb.DuckDBPyConnection, type_filter_list: List[str], fraud_only: bool, is_night: Optional[bool], step_start: Optional[int], step_end: Optional[int], granularity: str) -> Tuple[List[Dict[str, Any]], str, float]:
    time_col = 'day_number' if granularity == 'DAY' else 'week_number' if granularity == 'WEEK' else 'hour_of_day'
    
    sql = f"""
        SELECT 
            dt.{time_col} as period,
            dtt.type_name,
            COUNT(*) as tx_count,
            SUM(ft.amount) as total_amount
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
        
    sql += f" GROUP BY dt.{time_col}, dtt.type_name ORDER BY dt.{time_col}, dtt.type_name"
    return _execute_timed(con, sql, tuple(params))

def pivot_query(con: duckdb.DuckDBPyConnection, row_dim: str = "day_of_week", col_dim: str = "type_name", measure: str = "amount") -> Tuple[List[Dict[str, Any]], str, float]:
    row_expr = "dt.day_of_week" if "day" in str(row_dim).lower() else ("dtt.type_name" if "type" in str(row_dim).lower() else "dt.period_of_day")
    col_expr = "dtt.type_name" if "type" in str(col_dim).lower() else ("dt.day_of_week" if "day" in str(col_dim).lower() else "dt.period_of_day")
    measure_expr = "SUM(amount)" if "amount" in str(measure).lower() else "COUNT(tx_id)"
    
    sql = f"""
        PIVOT (
            SELECT 
                {row_expr} AS row_label,
                {col_expr} AS col_label,
                ft.tx_id,
                ft.amount
            FROM fact_transactions ft
            JOIN dim_time dt ON ft.time_key = dt.time_key
            JOIN dim_transaction_type dtt ON ft.type_key = dtt.type_key
        )
        ON col_label USING {measure_expr}
        GROUP BY row_label
    """
    
    return _execute_timed(con, sql)
