import os
import time
from fastapi import APIRouter, Request, HTTPException
from app.warehouse.connection import get_connection
from app.models.schemas import KPIMetrics
from app.config import WAREHOUSE_PATH
from app.intelligence.model_lab import saved_report

router = APIRouter()

@router.get("/api/health")
async def get_health(request: Request):
    app_state = request.app.state
    try:
        con = get_connection()
        res = con.execute("SELECT count(*) FROM fact_transactions").fetchone()
        row_count = res[0] if res else 0
        
        return {
            "status": "healthy",
            "uptime_seconds": time.time() - getattr(app_state, 'start_time', time.time()),
            "warehouse": {
                "transaction_count": row_count
            },
            "models": {
                "classifier_samples": getattr(app_state.classifier, 'total_samples', 0),
                "drift_detector_active": getattr(app_state, 'drift_detector', None) is not None
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/metrics/kpis", response_model=KPIMetrics)
async def get_kpis(request: Request):
    try:
        con = get_connection()
        
        total_tx = con.execute("SELECT count(*) FROM fact_transactions").fetchone()[0]
        fraud_tx = con.execute("SELECT count(*) FROM fact_transactions WHERE is_fraud_actual = TRUE").fetchone()[0]
        drift_cnt = con.execute("SELECT count(*) FROM fact_drift_events").fetchone()[0]
        
        app_state = request.app.state
        classifier = getattr(app_state, 'classifier', None)
        raw_acc = classifier.rolling_accuracy.get() if classifier and classifier.total_samples > 10 else None
        accuracy = float(raw_acc) if raw_acc is not None else 0.0
        f1 = classifier.rolling_f1.get() if classifier and classifier.total_samples > 10 else 0.0
        
        wh_size = round(os.path.getsize(WAREHOUSE_PATH) / (1024 * 1024), 2) if os.path.exists(WAREHOUSE_PATH) else 0.0
        
        return KPIMetrics(
            total_tx=total_tx,
            fraud_rate=round((fraud_tx / total_tx * 100), 2) if total_tx > 0 else 0.0,
            accuracy=round(float(accuracy), 4),
            f1=round(float(f1), 4),
            drift_count=drift_cnt,
            warehouse_mb=wh_size
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/metrics/overview")
async def get_overview(request: Request):
    """One consistent, labelled warehouse snapshot for the manager landing page."""
    con = get_connection()
    totals = con.execute("""
        SELECT count(*) AS transactions, coalesce(sum(amount),0) AS amount,
          coalesce(sum(is_fraud_actual),0) AS confirmed,
          coalesce(sum(is_fraud_pred),0) AS flagged,
          coalesce(sum(CASE WHEN is_fraud_actual=1 AND is_fraud_pred=1 THEN 1 ELSE 0 END),0) AS true_positives,
          min(step_number) AS first_step, max(step_number) AS last_step,
          max(ingested_at) AS last_ingested,
          count(*) FILTER (WHERE is_fraud_actual IS NOT NULL AND is_fraud_pred=1) AS labelled_flags
        FROM fact_transactions
    """).fetchone()
    types = con.execute("""
        SELECT d.type_name AS type, count(*) AS transactions,
          coalesce(sum(f.is_fraud_actual),0) AS confirmed,
          coalesce(sum(f.is_fraud_pred),0) AS flagged,
          coalesce(sum(f.amount),0) AS amount
        FROM fact_transactions f JOIN dim_transaction_type d ON f.type_key=d.type_key
        GROUP BY d.type_name ORDER BY confirmed DESC, transactions DESC
    """).fetchall()
    trend = con.execute("""
        SELECT t.week_number AS period, count(*) AS transactions,
          coalesce(sum(f.is_fraud_actual),0) AS confirmed,
          coalesce(sum(f.is_fraud_pred),0) AS flagged
        FROM fact_transactions f JOIN dim_time t ON f.time_key=t.time_key
        GROUP BY t.week_number ORDER BY t.week_number
    """).fetchall()
    drift = con.execute("SELECT count(*) FROM fact_drift_events").fetchone()[0]
    daily = con.execute('''SELECT t.day_number AS day,count(*) AS transactions,
        coalesce(sum(f.amount),0) AS amount,coalesce(sum(f.is_fraud_actual),0) AS confirmed
        FROM fact_transactions f JOIN dim_time t ON f.time_key=t.time_key GROUP BY 1 ORDER BY 1''').fetchall()
    activity = con.execute('''SELECT d.type_name AS type,t.period_of_day AS period,count(*) AS transactions
        FROM fact_transactions f JOIN dim_time t ON f.time_key=t.time_key
        JOIN dim_transaction_type d ON f.type_key=d.type_key GROUP BY 1,2''').fetchall()
    versions = con.execute('''SELECT coalesce(model_version,'Not scored') AS version,count(*) AS transactions,
        coalesce(sum(is_fraud_pred),0) AS flagged FROM fact_transactions GROUP BY 1 ORDER BY 2 DESC''').fetchall()
    report = saved_report(con, 'classification')
    return {
        "source": "PaySim synthetic sample in DuckDB",
        "grain": "One row per ingested transaction",
        "summary": dict(zip(("transactions","amount","confirmed","flagged","true_positives","first_step","last_step","last_ingested","labelled_flags"), totals)),
        "by_type": [dict(zip(("type","transactions","confirmed","flagged","amount"), r)) for r in types],
        "by_week": [dict(zip(("period","transactions","confirmed","flagged"), r)) for r in trend],
        "drift_events": drift,
        "by_day": [dict(zip(('day','transactions','amount','confirmed'), r)) for r in daily],
        "activity": [dict(zip(('type','period','transactions'), r)) for r in activity],
        "prediction_versions": [dict(zip(('version','transactions','flagged'), r)) for r in versions],
        "active_model": {'version': request.app.state.classifier.version,
                         'algorithm': 'CART decision tree', 'metrics': report['metrics'] if report else None,
                         'split': report['split'] if report else None},
    }
