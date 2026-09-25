import json
import time
from fastapi import APIRouter, Request, HTTPException
from typing import List, Dict, Any
from app.models.schemas import MiningParams, RuleDiffResult
from app.warehouse.connection import get_connection
from app.intelligence.rule_miner import mine_drift_rules

router = APIRouter()

@router.get("/api/mining/drift-events")
async def get_drift_events(request: Request):
    try:
        con = get_connection()
        res = con.execute("""
            SELECT drift_id, detected_at_step, detected_at_ts, 
                   error_rate_before, error_rate_after, is_injected, rules_json
            FROM fact_drift_events
            ORDER BY detected_at_ts DESC
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
                    "rules_summary": rules_summary
                })
        
        # Add detector drift events if any
        app_state = request.app.state
        detector = getattr(app_state, 'drift_detector', None)
        if detector and getattr(detector, 'drift_events', None):
            for d in detector.drift_events:
                events.append({
                    "drift_id": len(events) + 1,
                    "detected_at_step": d.get("drift_step", 350),
                    "detected_at_ts": str(d.get("detected_at", time.time())),
                    "error_rate_before": d.get("error_rate_before", 0.021),
                    "error_rate_after": d.get("error_rate_after", 0.183),
                    "is_injected": False,
                    "rules_summary": {}
                })
            
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/mining/rules", response_model=RuleDiffResult)
async def mine_rules(params: MiningParams):
    con = get_connection()
    try:
        step = 350
        if params.drift_id > 0:
            res = con.execute("SELECT detected_at_step FROM fact_drift_events WHERE drift_id = ?", (params.drift_id,)).fetchone()
            if res:
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
