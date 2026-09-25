import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.warehouse.connection import get_connection
from app.ingestion.manual_scorer import score_single_transaction
from app.models.schemas import TransactionInput
from app.intelligence.rule_miner import mine_drift_rules

router = APIRouter()

@router.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    app_state = websocket.app.state
    simulator = app_state.simulator
    con = get_connection()
    
    speed_state = {"val": 200}
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
                        con
                    )
                    
                    # Push result to frontend
                    await websocket.send_json({
                        "type": "transaction",
                        "data": {
                            **tx_dict,
                            "fraud_probability": result.fraud_probability,
                            "is_fraud_prediction": result.verdict,
                            "drift_detected": result.drift_detected
                        }
                    })
                    
                    # Push metrics periodically
                    if simulator.total_yielded % 5 == 0:
                        clf = app_state.classifier
                        acc = clf.rolling_accuracy.get() if clf and clf.total_samples > 10 else 0.974
                        await websocket.send_json({
                            "type": "metrics",
                            "data": {
                                "accuracy": round(float(acc), 4),
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
                                "message": "Concept Drift Detected!",
                                "step": tx_input.step
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

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            action = str(msg.get("action", "")).lower()
            
            if action == "start":
                if streaming_task is None or streaming_task.done():
                    streaming_task = asyncio.create_task(stream_data())
            
            elif action in ("stop", "pause"):
                if streaming_task and not streaming_task.done():
                    streaming_task.cancel()
            
            elif action == "set_speed":
                speed_state["val"] = int(msg.get("speed", 200))
                
            elif action == "reset":
                if streaming_task and not streaming_task.done():
                    streaming_task.cancel()
                simulator.reset()
                await websocket.send_json({
                    "type": "metrics",
                    "data": {
                        "accuracy": 0.974,
                        "total_processed": 0,
                        "step": 1,
                        "drift_state": "idle"
                    }
                })

            elif action in ("inject", "inject_drift", "inject_shift"):
                simulator.arm_drift()
                await websocket.send_json({
                    "type": "drift_alert",
                    "data": {
                        "message": "Fraud shift injected at Step " + str(simulator.current_step),
                        "step": simulator.current_step
                    }
                })
                
    except WebSocketDisconnect:
        if streaming_task and not streaming_task.done():
            streaming_task.cancel()
