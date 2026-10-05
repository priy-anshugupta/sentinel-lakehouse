import json
from fastapi import APIRouter, Request, HTTPException
from typing import List, Dict, Any
from app.models.schemas import MiningParams, RuleDiffResult
from app.warehouse.connection import get_connection
from app.intelligence.rule_miner import mine_drift_rules

router = APIRouter()

@router.get("/api/mining/drift-comparison/{drift_id}")
async def compare_drift(drift_id: int, window: int = 100):
    """Compare equal simulation-step windows around an observed drift event."""
    if window < 10 or window > 500:
        raise HTTPException(status_code=400, detail="Window must be 10–500 steps")
    con = get_connection()
    event = con.execute("SELECT detected_at_step FROM fact_drift_events WHERE drift_id=?", [drift_id]).fetchone()
    if not event:
        raise HTTPException(status_code=404, detail="Drift event not found")
    step = event[0]
    rows = con.execute("""
        SELECT CASE WHEN f.step_number < ? THEN 'before' ELSE 'after' END AS period,
          t.type_name AS type, count(*) AS transactions,
          coalesce(sum(f.is_fraud_actual),0) AS confirmed,
          coalesce(sum(f.is_fraud_pred),0) AS flagged
        FROM fact_transactions f JOIN dim_transaction_type t ON f.type_key=t.type_key
        WHERE f.step_number >= ? AND f.step_number < ?
        GROUP BY 1,2 ORDER BY 1,2
    """, [step, max(0,step-window), step+window]).fetchall()
    return {"drift_id":drift_id,"step":step,"window":window,
        "rows":[dict(zip(("period","type","transactions","confirmed","flagged"),r)) for r in rows]}

@router.get("/api/mining/drift-events")
async def get_drift_events(request: Request):
    try:
        con = get_connection()
        res = con.execute("""
            SELECT drift_id, detected_at_step, detected_at_ts, 
                   error_rate_before, error_rate_after, is_injected, rules_json, model_version
            FROM fact_drift_events
            ORDER BY drift_id DESC
        """).fetchdf()
        
        events = []
        if not res.empty:
            for _, row in res.iterrows():
                rules_summary = {}
                try:
                    if row.get("rules_json"):
                        rules_summary = json.loads(row["rules_json"])
                except Exception:
                    pass
                events.append({
                    "drift_id": int(row["drift_id"]),
                    "detected_at_step": int(row["detected_at_step"]),
                    "detected_at_ts": str(row["detected_at_ts"]),
                    "error_rate_before": float(row["error_rate_before"] or 0.0),
                    "error_rate_after": float(row["error_rate_after"] or 0.0),
                    "is_injected": bool(row["is_injected"]),
                    "rules_summary": rules_summary,
                    "model_version": row['model_version']
                })
        
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/mining/rules", response_model=RuleDiffResult)
async def mine_rules(params: MiningParams):
    con = get_connection()
    try:
        res = con.execute("SELECT detected_at_step FROM fact_drift_events WHERE drift_id = ?", (params.drift_id,)).fetchone()
        if not res:
            raise HTTPException(404, 'Choose a recorded drift event before comparing rules')
        step = res[0]
                
        result = mine_drift_rules(
            con,
            drift_step=step,
            window_size=params.window_size,
            min_support=params.min_support,
            min_confidence=params.min_confidence,
            min_lift=params.min_lift
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
