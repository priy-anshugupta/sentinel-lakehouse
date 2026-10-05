import io
import pandas as pd
import time
from app.models.schemas import CsvUploadResult
from app.intelligence.stream_classifier import StreamClassifier
from app.intelligence.drift_detector import DriftDetector
from app.warehouse.etl import transform_and_load_batch
from app.warehouse.drift_events import store_drift_event
from app.models.schemas import TransactionInput
from uuid import uuid4

async def process_csv_upload(
    file_content: bytes,
    classifier: StreamClassifier,
    drift_detector: DriftDetector,
    con,
    source: str = 'CSV upload'
) -> CsvUploadResult:
    # Read CSV
    try:
        df = pd.read_csv(io.BytesIO(file_content))
    except Exception as e:
        raise ValueError(f"Invalid CSV format: {str(e)}")

    required_columns = ['step', 'type', 'amount', 'oldbalanceOrg', 'newbalanceOrig', 'oldbalanceDest', 'newbalanceDest']
    missing = [col for col in required_columns if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    batch = []
    predictions = []
    fraud_predictions = 0
    drift_count = 0
    drift_infos = []
    rejected = 0
    
    for _, row in df.iterrows():
        raw = row.to_dict()
        raw = {key: None if pd.isna(value) else value for key, value in raw.items()}
        # Validate before touching metrics, detector or warehouse.
        try:
            tx = TransactionInput(**raw)
            raw = tx.model_dump()
            raw['type'] = tx.type.value
        except (ValueError, TypeError):
            rejected += 1
            continue
        label = tx.isFraud
        
        ml_res = classifier.predict_and_learn(raw, label=label) if classifier.model is not None else {
            'prediction': None, 'fraud_probability': None, 'error': None, 'model_version': None}
        pred = ml_res['prediction']
        prob = ml_res['fraud_probability']
        error = ml_res.get('error')
        
        if pred == 1:
            fraud_predictions += 1
            
        if error is not None and drift_detector:
            step = int(raw.get('step', 0))
            drift_info = drift_detector.update(error, step)
            if drift_info is not None:
                drift_info['model_version'] = ml_res.get('model_version','legacy-online')
                drift_count += 1
                drift_infos.append(drift_info)
                
        batch.append(raw)
        predictions.append({'verdict': pred, 'fraud_probability': prob, 'model_version': ml_res.get('model_version')})

    # Load entire batch into warehouse
    transform_and_load_batch(con, batch, predictions)
    for drift_info in drift_infos:
        store_drift_event(con, drift_info)
    
    total = len(df)
    con.execute('INSERT INTO ingestion_runs(batch_id,source,total,valid,rejected) VALUES (?,?,?,?,?)',
                [uuid4().hex, source, total, len(batch), rejected])
    con.execute('CHECKPOINT')
    return CsvUploadResult(
        total=total,
        valid=len(batch),
        rejected=rejected,
        fraud_flagged=fraud_predictions,
        drift_triggered=drift_count
    )
