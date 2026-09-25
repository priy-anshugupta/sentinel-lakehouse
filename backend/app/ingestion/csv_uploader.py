import io
import pandas as pd
import time
from app.models.schemas import CsvUploadResult
from app.intelligence.stream_classifier import StreamClassifier
from app.intelligence.drift_detector import DriftDetector
from app.warehouse.etl import transform_and_load_batch

async def process_csv_upload(
    file_content: bytes,
    classifier: StreamClassifier,
    drift_detector: DriftDetector,
    con
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
    
    for _, row in df.iterrows():
        raw = row.to_dict()
        label = int(raw['isFraud']) if 'isFraud' in raw and not pd.isna(raw['isFraud']) else None
        
        ml_res = classifier.predict_and_learn(raw, label=label)
        pred = ml_res['prediction']
        prob = ml_res['fraud_probability']
        error = ml_res.get('error')
        
        if pred == 1:
            fraud_predictions += 1
            
        if error is not None and drift_detector:
            step = int(raw.get('step', 0))
            if drift_detector.update(error, step) is not None:
                drift_count += 1
                
        batch.append(raw)
        predictions.append({'verdict': pred, 'fraud_probability': prob})

    # Load entire batch into warehouse
    transform_and_load_batch(con, batch, predictions)
    
    total = len(df)
    return CsvUploadResult(
        total=total,
        valid=total,
        rejected=0,
        fraud_flagged=fraud_predictions,
        drift_triggered=drift_count
    )
