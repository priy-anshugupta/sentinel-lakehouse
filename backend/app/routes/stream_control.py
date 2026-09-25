from fastapi import APIRouter, Request, HTTPException
from app.models.schemas import StreamControlAction, StreamStatus, StreamAction, StreamState
from app.warehouse.connection import get_connection

router = APIRouter()

@router.post("/api/stream/control")
async def control_stream(action: StreamControlAction, request: Request):
    app_state = request.app.state
    simulator = getattr(app_state, 'simulator', None)
    
    if not simulator:
        raise HTTPException(status_code=500, detail="Stream simulator not initialized")
    
    if action.action == StreamAction.START:
        return {"success": True, "message": "Stream started via REST (use WebSocket for live data)"}
    elif action.action == StreamAction.PAUSE:
        return {"success": True, "message": "Stream paused via REST"}
    elif action.action == StreamAction.RESET:
        simulator.reset()
        # Also reset ML states
        if hasattr(app_state, 'classifier'):
            app_state.classifier.reset()
        if hasattr(app_state, 'drift_detector'):
            app_state.drift_detector.reset()
        return {"success": True, "message": "Stream and models reset"}
    elif action.action == StreamAction.INJECT:
        simulator.arm_drift()
        return {"success": True, "message": "Fraud shift injection armed"}
    elif action.action == StreamAction.SET_SPEED:
        # Speed is handled client-side in the WebSocket handler
        return {"success": True, "speed": action.speed}
    
    raise HTTPException(status_code=400, detail=f"Unknown action: {action.action}")

@router.get("/api/stream/status", response_model=StreamStatus)
async def get_stream_status(request: Request):
    app_state = request.app.state
    simulator = getattr(app_state, 'simulator', None)
    
    if not simulator:
        raise HTTPException(status_code=500, detail="Stream simulator not initialized")
    
    classifier = getattr(app_state, 'classifier', None)
    
    return StreamStatus(
        state=StreamState.IDLE,
        current_step=simulator.current_step,
        speed=200,
        total_processed=simulator.total_yielded
    )

@router.get("/api/stream/recent")
async def get_recent_stream_transactions(limit: int = 20):
    try:
        con = get_connection()
        query = """
            SELECT 
                f.tx_id,
                COALESCE(f.step_number, dt.step, 1) AS step,
                COALESCE(dtt.type_name, 'TRANSFER') AS type,
                f.amount,
                COALESCE(da_orig.account_id, 'C' || CAST(f.orig_acc_key AS VARCHAR)) AS nameOrig,
                COALESCE(da_dest.account_id, 'M' || CAST(f.dest_acc_key AS VARCHAR)) AS nameDest,
                f.is_fraud_pred,
                f.fraud_probability,
                f.is_fraud_actual,
                f.ingested_at
            FROM fact_transactions f
            LEFT JOIN dim_time dt ON f.time_key = dt.time_key
            LEFT JOIN dim_transaction_type dtt ON f.type_key = dtt.type_key
            LEFT JOIN dim_account da_orig ON f.orig_acc_key = da_orig.acc_key
            LEFT JOIN dim_account da_dest ON f.dest_acc_key = da_dest.acc_key
            ORDER BY f.tx_id DESC
            LIMIT ?
        """
        rows = con.execute(query, [limit]).fetchall()
        transactions = []
        for r in rows:
            is_fraud_val = bool(r[6])
            prob = float(r[7]) if r[7] is not None else (0.95 if is_fraud_val else 0.05)
            orig_name = str(r[4] or 'C1000')
            dest_name = str(r[5] or 'M1000')
            flow = f"{orig_name[:4]}→{dest_name[:4]}" if len(orig_name) >= 4 and len(dest_name) >= 4 else "C→M"
            
            transactions.append({
                "tx_id": r[0],
                "step": int(r[1] or 1),
                "type": r[2] or "TRANSFER",
                "amount": float(r[3] or 0.0),
                "nameOrig": orig_name,
                "nameDest": dest_name,
                "isFraudPrediction": is_fraud_val,
                "fraudProbability": prob,
                "is_fraud_actual": bool(r[8]),
                "flow": flow,
                "ingested_at": str(r[9])
            })
        return {"transactions": transactions}
    except Exception as e:
        return {"transactions": [], "error": str(e)}