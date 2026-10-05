import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.warehouse.connection import get_connection
from app.ingestion.manual_scorer import score_single_transaction
from app.models.schemas import TransactionInput
from app.intelligence.rule_miner import mine_drift_rules
from app.auth import websocket_user

router = APIRouter()

@router.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    user = websocket_user(websocket)
    if not user or user['role'] == 'BRANCH_MANAGER':
        await websocket.close(code=1008)
        return
    await websocket.accept()
    app_state = websocket.app.state
    simulator = app_state.simulator
    con = get_connection()
    
    speed_state = app_state.stream_speed
    streaming_task = None
    
    async def stream_data():
        try:
            async for batch in simulator.replay(speed=speed_state):
                for tx_dict in batch:
                    # Convert float step back to int if needed
                    tx_dict['step'] = int(tx_dict.get('step', 1))
                    tx_input = TransactionInput(**tx_dict)
                    
                    # Score and ingest
                    result = await score_single_transaction(
                        tx_input,
                        app_state.classifier,
                        app_state.drift_detector,
                        con,
                        is_injected=simulator.is_injected,
                    )
                    
                    # Push result to frontend
                    await websocket.send_json({
                        "type": "transaction",
                        "data": {
                            **tx_dict,
                            "tx_id": result.tx_id,
                            "fraud_probability": result.fraud_probability,
                            "is_fraud_prediction": result.verdict,
                            "drift_detected": result.drift_detected,
                            "model_version": result.model_version
                        }
                    })
                    
                    # Push metrics periodically
                    if simulator.total_yielded % 5 == 0:
                        clf = app_state.classifier
                        acc = clf.rolling_accuracy.get() if clf and clf.total_samples > 10 else None
                        await websocket.send_json({
                            "type": "metrics",
                            "data": {
                                "accuracy": round(float(acc), 4) if acc is not None else None,
                                "total_processed": simulator.total_yielded,
                                "step": simulator.current_step,
                                "drift_state": "drift_detected" if result.drift_detected else "monitoring"
                            }
                        })
                        
                    # Handle drift detection automation
                    if result.drift_detected:
                        await websocket.send_json({
                            "type": "drift_alert",
                            "data": {
                                "message": f"The model's prediction errors changed around simulation step {tx_input.step}.",
                                "step": tx_input.step,
                                "drift_id": result.drift_id,
                            }
                        })
                        
                        # Trigger rule mining
                        try:
                            rules = mine_drift_rules(con, drift_step=tx_input.step)
                            await websocket.send_json({
                                "type": "rules_ready",
                                "data": rules
                            })
                        except Exception as e:
                            print(f"Error mining rules: {e}")
                            
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Streaming error: {e}")
            await websocket.send_json({"type": "error", "message": str(e)})
        finally:
            app_state.stream_state = 'PAUSED'

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            action = str(msg.get("action", "")).lower()
            
            if action == "start":
                if streaming_task is None or streaming_task.done():
                    if app_state.stream_task and not app_state.stream_task.done():
                        await websocket.send_json({'type':'error','message':'Another monitor is already replaying this warehouse. Pause it first.'})
                        continue
                    streaming_task = asyncio.create_task(stream_data())
                    app_state.stream_task = streaming_task
                    app_state.stream_state = 'RUNNING'
            
            elif action in ("stop", "pause"):
                if streaming_task and not streaming_task.done():
                    streaming_task.cancel()
                    await streaming_task
                app_state.stream_state = 'PAUSED'
            
            elif action == "set_speed":
                speed_state["val"] = max(50,min(1000,int(msg.get("speed",200))))
                
            elif action == "reset":
                if streaming_task and not streaming_task.done():
                    streaming_task.cancel()
                    await streaming_task
                simulator.reset()
                app_state.stream_state = 'IDLE'
                await websocket.send_json({
                    "type": "metrics",
                    "data": {
                        "accuracy": None,
                        "total_processed": 0,
                        "step": 1,
                        "drift_state": "idle"
                    }
                })

            elif action in ("inject", "inject_drift", "inject_shift"):
                if user['role'] != 'DATA_ENGINEER':
                    await websocket.send_json({'type':'error','message':'Engineer access required for simulation scenarios.'})
                    continue
                simulator.arm_drift()
                await websocket.send_json({
                    "type": "simulation_notice",
                    "data": {
                        "message": "A simulated change is armed for subsequent fraud-labelled rows. This is not a detected drift event.",
                        "step": simulator.current_step
                    }
                })
                
    except WebSocketDisconnect:
        if streaming_task and not streaming_task.done():
            streaming_task.cancel()
            await streaming_task
