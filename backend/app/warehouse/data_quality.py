import duckdb
from typing import List, Dict, Any

def run_quality_checks(con: duckdb.DuckDBPyConnection) -> List[Dict[str, Any]]:
    checks = []
    
    # Null check on required fact columns
    null_res = con.execute("""
        SELECT COUNT(*) FROM fact_transactions 
        WHERE time_key IS NULL OR type_key IS NULL OR amount IS NULL
    """).fetchone()[0]
    checks.append({
        "name": "Null Fact Columns Check",
        "status": "PASS" if null_res == 0 else "FAIL",
        "detail": f"{null_res} rows have null required columns."
    })
    
    # Orphan FK check
    orphan_res = con.execute("""
        SELECT COUNT(*) FROM fact_transactions ft
        LEFT JOIN dim_time dt ON ft.time_key = dt.time_key
        WHERE dt.time_key IS NULL
    """).fetchone()[0]
    checks.append({
        "name": "Orphan Foreign Key Check",
        "status": "PASS" if orphan_res == 0 else "FAIL",
        "detail": f"{orphan_res} fact rows point to non-existent time keys."
    })
    
    # Negative amount check
    neg_res = con.execute("""
        SELECT COUNT(*) FROM fact_transactions WHERE amount < 0
    """).fetchone()[0]
    checks.append({
        "name": "Negative Amount Check",
        "status": "PASS" if neg_res == 0 else "FAIL",
        "detail": f"{neg_res} rows have negative amounts."
    })
    
    # Duplicate tx_id check
    dup_res = con.execute("""
        SELECT COUNT(*) FROM (
            SELECT tx_id FROM fact_transactions GROUP BY tx_id HAVING COUNT(*) > 1
        ) sub
    """).fetchone()[0]
    checks.append({
        "name": "Duplicate TX ID Check",
        "status": "PASS" if dup_res == 0 else "FAIL",
        "detail": f"{dup_res} duplicate transaction IDs found."
    })
    
    # Balance anomaly check
    anomaly_res = con.execute("""
        SELECT COUNT(*) FROM fact_transactions 
        WHERE orig_balance_delta > amount
    """).fetchone()[0]
    checks.append({
        "name": "Balance Anomaly Check",
        "status": "PASS" if anomaly_res == 0 else "WARNING",
        "detail": f"{anomaly_res} transactions have original balance increase greater than amount."
    })
    
    return checks
