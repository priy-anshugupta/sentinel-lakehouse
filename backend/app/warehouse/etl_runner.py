#!/usr/bin/env python
"""Full ETL pipeline to load PaySim data into DuckDB warehouse."""
import os
import sys
import asyncio
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import duckdb
import pandas as pd

from app.warehouse.connection import get_connection
from app.warehouse.ddl import create_schema
from app.warehouse.etl import populate_dim_time, transform_and_load_batch, get_or_create_account, get_type_key
from app.intelligence.stream_classifier import StreamClassifier
from app.intelligence.drift_detector import DriftDetector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_full_etl(csv_path: str, batch_size: int = 1000, speed: int = 0):
    """Load entire PaySim CSV into warehouse with streaming classification."""
    logger.info(f"Starting full ETL from {csv_path}")
    
    con = get_connection()
    create_schema(con)
    populate_dim_time(con)
    
    classifier = StreamClassifier()
    drift_detector = DriftDetector()
    
    total_rows = 0
    fraud_count = 0
    drift_events = 0
    
    # Read CSV in chunks
    for chunk_idx, chunk in enumerate(pd.read_csv(csv_path, chunksize=batch_size)):
        batch = chunk.to_dict(orient='records')
        
        predictions = []
        for row in batch:
            step = int(row.get('step', 0))
            
            # Apply drift injection if needed
            if step >= 350 and row.get('isFraud') == 1:
                row['type'] = 'TRANSFER'
                row['amount'] = float(row['amount']) * 0.4
                if 'oldbalanceOrg' in row:
                    row['newbalanceOrig'] = float(row['oldbalanceOrg']) - float(row['amount'])
            
            features = {
                'type': row.get('type', 'UNKNOWN'),
                'amount': float(row.get('amount', 0)),
                'oldbalanceOrg': float(row.get('oldbalanceOrg', 0)),
                'newbalanceOrig': float(row.get('newbalanceOrig', 0)),
                'oldbalanceDest': float(row.get('oldbalanceDest', 0)),
                'newbalanceDest': float(row.get('newbalanceDest', 0)),
                'step': step
            }
            
            label = int(row.get('isFraud', 0))
            ml_res = classifier.predict_and_learn(features, label=label)
            pred = ml_res['prediction']
            prob = ml_res['fraud_probability']
            error = ml_res.get('error')
            
            if pred == 1:
                fraud_count += 1
                
            if error is not None:
                drift_info = drift_detector.update(error, step)
                if drift_info:
                    drift_events += 1
                    # Log drift event
                    con.execute("""
                        INSERT INTO fact_drift_events 
                        (detected_at_step, pre_window_start, pre_window_end, post_window_start, post_window_end,
                         error_rate_before, error_rate_after, is_injected, rules_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        drift_info['drift_step'],
                        max(0, drift_info['drift_step'] - 200),
                        drift_info['drift_step'],
                        drift_info['drift_step'],
                        drift_info['drift_step'] + 200,
                        drift_info.get('error_rate_before', 0.0),
                        drift_info.get('error_rate_after', 0.0),
                        step >= 350,
                        '{}'
                    ))
            
            predictions.append({'verdict': pred, 'fraud_probability': prob})
        
        # Add nameOrig/nameDest for warehouse loading
        for row in batch:
            row['nameOrig'] = row.get('nameOrig', f'C_{total_rows}')
            row['nameDest'] = row.get('nameDest', f'M_{total_rows}')
            row['isFraud'] = int(row.get('isFraud', 0))
        
        transform_and_load_batch(con, batch, predictions)
        
        total_rows += len(batch)
        
        if chunk_idx % 10 == 0:
            logger.info(f"Processed {total_rows} rows, fraud detected: {fraud_count}, drift events: {drift_events}")
        
        if speed > 0:
            await asyncio.sleep(batch_size / speed)
    
    logger.info(f"ETL complete: {total_rows} rows loaded, {fraud_count} fraud predictions, {drift_events} drift events")
    return total_rows, fraud_count, drift_events


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default="data/paysim.csv")
    parser.add_argument("--batch", type=int, default=1000)
    parser.add_argument("--speed", type=int, default=0)
    args = parser.parse_args()
    
    csv_path = Path(args.csv).resolve()
    if not csv_path.exists():
        logger.error(f"CSV not found: {csv_path}")
        sys.exit(1)
    
    asyncio.run(run_full_etl(str(csv_path), args.batch, args.speed))