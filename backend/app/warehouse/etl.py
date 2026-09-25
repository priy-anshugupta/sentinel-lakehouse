import duckdb
from typing import List, Dict, Any

def populate_dim_time(con: duckdb.DuckDBPyConnection):
    count = con.execute("SELECT COUNT(*) FROM dim_time").fetchone()[0]
    if count >= 744:
        return
    
    days_of_week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    data = []
    for step in range(744):
        hour_of_day = step % 24
        period_of_day = 'Morning' if 6 <= hour_of_day < 12 else \
                        'Afternoon' if 12 <= hour_of_day < 18 else \
                        'Evening' if 18 <= hour_of_day < 24 else 'Night'
        day_number = step // 24
        day_of_week = days_of_week[day_number % 7]
        week_number = day_number // 7
        is_night = hour_of_day < 6 or hour_of_day >= 22
        is_weekend = day_of_week in ['Sat', 'Sun']
        
        data.append((step, step, hour_of_day, period_of_day, day_number, day_of_week, week_number, is_night, is_weekend))
        
    con.executemany("""
        INSERT INTO dim_time (time_key, step, hour_of_day, period_of_day, day_number, day_of_week, week_number, is_night, is_weekend)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, data)

_account_cache = {}
_type_cache = {}

def get_or_create_account(con: duckdb.DuckDBPyConnection, account_id: str, current_step: int = 0) -> int:
    if account_id in _account_cache:
        return _account_cache[account_id]

    result = con.execute("SELECT acc_key FROM dim_account WHERE account_id = ?", (account_id,)).fetchone()
    if result:
        _account_cache[account_id] = result[0]
        return result[0]
    
    acc_key_res = con.execute("SELECT COALESCE(MAX(acc_key), 0) + 1 FROM dim_account").fetchone()
    acc_key = acc_key_res[0] if acc_key_res else 1
    
    prefix = account_id[0] if account_id else 'U'
    account_type = 'CUSTOMER' if prefix == 'C' else 'MERCHANT' if prefix == 'M' else 'UNKNOWN'
    
    con.execute("""
        INSERT INTO dim_account (acc_key, account_id, account_type, name_prefix, first_seen_step, risk_tier)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (acc_key, account_id, account_type, prefix, current_step, 'LOW'))
    _account_cache[account_id] = acc_key
    return acc_key

def get_type_key(con: duckdb.DuckDBPyConnection, type_name: str) -> int:
    if type_name in _type_cache:
        return _type_cache[type_name]
    result = con.execute("SELECT type_key FROM dim_transaction_type WHERE type_name = ?", (type_name,)).fetchone()
    key = result[0] if result else 1 
    _type_cache[type_name] = key
    return key

def transform_and_load_batch(con: duckdb.DuckDBPyConnection, batch: List[Dict[str, Any]], predictions: List[Dict[str, Any]]):
    insert_data = []
    
    for row, pred in zip(batch, predictions):
        step = int(row.get('step', 0))
        time_key = step
        
        type_name = row.get('type', 'UNKNOWN')
        type_key = get_type_key(con, type_name)
        
        orig_acc_key = get_or_create_account(con, row.get('nameOrig', 'UNKNOWN'), step)
        dest_acc_key = get_or_create_account(con, row.get('nameDest', 'UNKNOWN'), step)
        
        amount = float(row.get('amount', 0))
        orig_balance_delta = float(row.get('newbalanceOrig', 0)) - float(row.get('oldbalanceOrg', 0))
        dest_balance_delta = float(row.get('newbalanceDest', 0)) - float(row.get('oldbalanceDest', 0))
        
        is_fraud_actual = int(row.get('isFraud', 0))
        is_fraud_pred = int(pred.get('verdict', 0))
        fraud_prob = float(pred.get('fraud_probability', 0.0))
        pred_error = abs(is_fraud_actual - fraud_prob)
        
        insert_data.append((
            time_key, type_key, orig_acc_key, dest_acc_key, amount, 
            orig_balance_delta, dest_balance_delta, is_fraud_actual, 
            is_fraud_pred, fraud_prob, pred_error, step
        ))
        
    if insert_data:
        con.executemany("""
            INSERT INTO fact_transactions (
                time_key, type_key, orig_acc_key, dest_acc_key, amount, 
                orig_balance_delta, dest_balance_delta, is_fraud_actual, 
                is_fraud_pred, fraud_probability, prediction_error, step_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, insert_data)
