import duckdb
import pandas as pd
from typing import List, Dict, Any

def populate_dim_time(con: duckdb.DuckDBPyConnection, max_step: int = 744):
    
    days_of_week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    data = []
    existing = {r[0] for r in con.execute('SELECT time_key FROM dim_time').fetchall()}
    for step in range(1, max_step + 1):
        if step in existing:
            continue
        hour_of_day = (step - 1) % 24
        period_of_day = 'Morning' if 6 <= hour_of_day < 12 else \
                        'Afternoon' if 12 <= hour_of_day < 18 else \
                        'Evening' if 18 <= hour_of_day < 24 else 'Night'
        day_number = (step - 1) // 24 + 1
        day_of_week = days_of_week[(day_number - 1) % 7]
        week_number = (step - 1) // 168 + 1
        is_night = hour_of_day < 6 or hour_of_day >= 22
        is_weekend = day_of_week in ['Sat', 'Sun']
        
        data.append((step, step, hour_of_day, period_of_day, day_number, day_of_week, week_number, is_night, is_weekend))
        
    if data:
        con.executemany("""
        INSERT INTO dim_time (time_key, step, hour_of_day, period_of_day, day_number, day_of_week, week_number, is_night, is_weekend)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, data)
    # Normalise legacy derived attributes, preserving referenced time keys.
    con.execute('''UPDATE dim_time SET
        hour_of_day = (step - 1) % 24,
        day_number = CAST(FLOOR((step - 1) / 24) AS INTEGER) + 1,
        week_number = CAST(FLOOR((step - 1) / 168) AS INTEGER) + 1,
        day_of_week = list_extract(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], CAST(FLOOR((step - 1) / 24) AS INTEGER) % 7 + 1),
        period_of_day = CASE WHEN (step-1)%24 < 6 THEN 'Night' WHEN (step-1)%24 < 12 THEN 'Morning' WHEN (step-1)%24 < 18 THEN 'Afternoon' ELSE 'Evening' END,
        is_night = ((step-1)%24 < 6 OR (step-1)%24 >= 22),
        is_weekend = (CAST(FLOOR((step-1)/24) AS INTEGER)%7 >= 5)
        WHERE step >= 1''')

def get_or_create_account(con: duckdb.DuckDBPyConnection, account_id: str, current_step: int = 0) -> int:
    result = con.execute("SELECT acc_key FROM dim_account WHERE account_id = ?", (account_id,)).fetchone()
    if result:
        return result[0]
    
    acc_key_res = con.execute("SELECT COALESCE(MAX(acc_key), 0) + 1 FROM dim_account").fetchone()
    acc_key = acc_key_res[0] if acc_key_res else 1
    
    prefix = account_id[0] if account_id else 'U'
    account_type = 'CUSTOMER' if prefix == 'C' else 'MERCHANT' if prefix == 'M' else 'UNKNOWN'
    
    con.execute("""
        INSERT INTO dim_account (acc_key, account_id, account_type, name_prefix, first_seen_step, risk_tier)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (acc_key, account_id, account_type, prefix, current_step, 'LOW'))
    return acc_key

def get_type_key(con: duckdb.DuckDBPyConnection, type_name: str) -> int:
    result = con.execute("SELECT type_key FROM dim_transaction_type WHERE type_name = ?", (type_name,)).fetchone()
    if not result:
        raise ValueError(f'Unsupported transaction type: {type_name}')
    key = result[0]
    return key

def transform_and_load_batch(con: duckdb.DuckDBPyConnection, batch: List[Dict[str, Any]], predictions: List[Dict[str, Any]]):
    if len(batch) != len(predictions):
        raise ValueError('Each transaction needs one scoring result')
    if batch:
        largest = max(int(row['step']) for row in batch)
        if con.execute('SELECT count(*) FROM dim_time WHERE time_key=?', [largest]).fetchone()[0] == 0:
            populate_dim_time(con, largest)
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
        
        known_label = row.get('isFraud')
        is_fraud_actual = None if pd.isna(known_label) else int(known_label)
        is_fraud_pred = int(pred['verdict']) if pred.get('verdict') is not None else None
        fraud_prob = float(pred['fraud_probability']) if pred.get('fraud_probability') is not None else None
        pred_error = abs(is_fraud_actual - fraud_prob) if is_fraud_actual is not None and fraud_prob is not None else None
        
        insert_data.append((
            time_key, type_key, orig_acc_key, dest_acc_key, amount, 
            orig_balance_delta, dest_balance_delta, is_fraud_actual, 
            is_fraud_pred, fraud_prob, pred_error, step, pred.get('model_version')
        ))
        
    if insert_data:
        con.executemany("""
            INSERT INTO fact_transactions (
                time_key, type_key, orig_acc_key, dest_acc_key, amount, 
                orig_balance_delta, dest_balance_delta, is_fraud_actual, 
                is_fraud_pred, fraud_probability, prediction_error, step_number, model_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, insert_data)
