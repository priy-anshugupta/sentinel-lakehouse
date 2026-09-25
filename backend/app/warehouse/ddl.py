import duckdb

def create_schema(con: duckdb.DuckDBPyConnection):
    # Sequences
    con.execute("CREATE SEQUENCE IF NOT EXISTS tx_seq START 1;")
    con.execute("CREATE SEQUENCE IF NOT EXISTS drift_seq START 1;")
    
    # dim_time
    con.execute("""
        CREATE TABLE IF NOT EXISTS dim_time (
            time_key INTEGER PRIMARY KEY,
            step INTEGER,
            hour_of_day INTEGER,
            period_of_day VARCHAR,
            day_number INTEGER,
            day_of_week VARCHAR,
            week_number INTEGER,
            is_night BOOLEAN,
            is_weekend BOOLEAN
        );
    """)
    
    # dim_account
    con.execute("""
        CREATE TABLE IF NOT EXISTS dim_account (
            acc_key INTEGER PRIMARY KEY,
            account_id VARCHAR UNIQUE,
            account_type VARCHAR,
            name_prefix VARCHAR,
            first_seen_step INTEGER,
            risk_tier VARCHAR
        );
    """)
    
    # dim_transaction_type
    con.execute("""
        CREATE TABLE IF NOT EXISTS dim_transaction_type (
            type_key INTEGER PRIMARY KEY,
            type_name VARCHAR UNIQUE,
            type_code VARCHAR,
            risk_weight FLOAT,
            is_cashout BOOLEAN,
            description VARCHAR
        );
    """)
    
    # Seed dim_transaction_type
    con.execute("""
        INSERT INTO dim_transaction_type (type_key, type_name, type_code, risk_weight, is_cashout, description)
        VALUES 
        (1, 'PAYMENT', 'PAY', 0.1, false, 'Payment for goods or services'),
        (2, 'TRANSFER', 'TRF', 0.8, false, 'Transfer to another account'),
        (3, 'CASH_OUT', 'CSH_OUT', 0.9, true, 'Cash withdrawal'),
        (4, 'DEBIT', 'DBT', 0.2, false, 'Debit from account'),
        (5, 'CASH_IN', 'CSH_IN', 0.1, false, 'Cash deposit')
        ON CONFLICT (type_name) DO NOTHING;
    """)
    
    # fact_transactions
    con.execute("""
        CREATE TABLE IF NOT EXISTS fact_transactions (
            tx_id INTEGER PRIMARY KEY DEFAULT nextval('tx_seq'),
            time_key INTEGER,
            type_key INTEGER,
            orig_acc_key INTEGER,
            dest_acc_key INTEGER,
            amount DOUBLE,
            orig_balance_delta DOUBLE,
            dest_balance_delta DOUBLE,
            is_fraud_actual INTEGER,
            is_fraud_pred INTEGER,
            fraud_probability DOUBLE,
            prediction_error DOUBLE,
            step_number INTEGER,
            ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (time_key) REFERENCES dim_time(time_key),
            FOREIGN KEY (type_key) REFERENCES dim_transaction_type(type_key),
            FOREIGN KEY (orig_acc_key) REFERENCES dim_account(acc_key),
            FOREIGN KEY (dest_acc_key) REFERENCES dim_account(acc_key)
        );
    """)
    
    # fact_drift_events
    con.execute("""
        CREATE TABLE IF NOT EXISTS fact_drift_events (
            drift_id INTEGER PRIMARY KEY DEFAULT nextval('drift_seq'),
            detected_at_step INTEGER,
            detected_at_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            pre_window_start INTEGER,
            pre_window_end INTEGER,
            post_window_start INTEGER,
            post_window_end INTEGER,
            error_rate_before DOUBLE,
            error_rate_after DOUBLE,
            is_injected BOOLEAN,
            rules_json VARCHAR
        );
    """)
