"""Incremental in-app alert feed backed by warehouse facts."""

from fastapi import APIRouter
from app.warehouse.connection import get_connection

router = APIRouter()


@router.get("/api/alerts/changes")
async def get_alert_changes(after_tx_id: int | None = None, after_drift_id: int | None = None):
    con = get_connection()
    latest_tx = int(con.execute("SELECT coalesce(max(tx_id), 0) FROM fact_transactions").fetchone()[0])
    latest_drift = int(con.execute("SELECT coalesce(max(drift_id), 0) FROM fact_drift_events").fetchone()[0])

    # First request establishes a cursor, so opening the app never raises old sample alerts.
    if after_tx_id is None or after_drift_id is None:
        return {"next_tx_id": latest_tx, "next_drift_id": latest_drift,
                "transactions": [], "drift_events": []}

    rows = con.execute("""
        SELECT f.tx_id, f.step_number, t.type_name, f.is_fraud_pred, f.is_fraud_actual
        FROM fact_transactions f
        JOIN dim_transaction_type t ON f.type_key = t.type_key
        WHERE f.tx_id > ? AND (f.is_fraud_pred = 1 OR f.is_fraud_actual = 1)
        ORDER BY f.tx_id ASC LIMIT 200
    """, [max(after_tx_id, 0)]).fetchall()
    drift_rows = con.execute("""
        SELECT drift_id, detected_at_step FROM fact_drift_events
        WHERE drift_id > ? ORDER BY drift_id ASC LIMIT 50
    """, [max(after_drift_id, 0)]).fetchall()

    return {
        "next_tx_id": int(rows[-1][0]) if len(rows) == 200 else latest_tx,
        "next_drift_id": int(drift_rows[-1][0]) if len(drift_rows) == 50 else latest_drift,
        "transactions": [{
            "tx_id": int(tx_id), "step": int(step), "type": tx_type,
            "is_fraud_prediction": int(prediction),
            "isFraud": None if label is None else int(label),
        } for tx_id, step, tx_type, prediction, label in rows],
        "drift_events": [{"drift_id": int(drift_id), "step": int(step)}
                         for drift_id, step in drift_rows],
    }
