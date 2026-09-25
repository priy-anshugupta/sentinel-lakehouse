import time
from app.models.schemas import TransactionInput, TransactionResult
from app.intelligence.stream_classifier import StreamClassifier
from app.intelligence.drift_detector import DriftDetector
from app.warehouse.etl import transform_and_load_batch

async def score_single_transaction(
    tx: TransactionInput,
    classifier: StreamClassifier,
    drift_detector: DriftDetector,
    con
) -> TransactionResult:
    start_time = time.perf_counter()
    
    # Prepare features
    tx_type_str = tx.type.value if hasattr(tx.type, 'value') else str(tx.type)
    features = {
        'type': tx_type_str,
        'amount': float(tx.amount),
        'oldbalanceOrg': float(tx.oldbalanceOrg),
        'newbalanceOrig': float(tx.newbalanceOrig),
        'oldbalanceDest': float(tx.oldbalanceDest),
        'newbalanceDest': float(tx.newbalanceDest),
        'step': int(tx.step)
    }
    
    # Predict and learn
    ml_res = classifier.predict_and_learn(features, label=tx.isFraud)
    pred = ml_res['prediction']
    prob = ml_res['fraud_probability']
    error = ml_res.get('error')
    
    drift_detected = False
    if error is not None and drift_detector:
        drift_info = drift_detector.update(error, tx.step)
        drift_detected = drift_info is not None

    # Store in warehouse
    raw_dict = features.copy()
    raw_dict['isFraud'] = tx.isFraud if tx.isFraud is not None else 0
    raw_dict['nameOrig'] = 'C_MANUAL'
    raw_dict['nameDest'] = 'M_MANUAL'
    
    pred_dict = {
        'verdict': pred,
        'fraud_probability': prob
    }
    transform_and_load_batch(con, [raw_dict], [pred_dict])
    
    # Get the latest tx_id
    res = con.execute("SELECT MAX(tx_id) FROM fact_transactions").fetchone()
    tx_id = res[0] if res and res[0] is not None else 1
    
    exec_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return TransactionResult(
        tx_id=tx_id,
        fraud_probability=prob,
        verdict=pred,
        drift_detected=drift_detected,
        latency_ms=exec_time_ms
    )
