from fastapi import APIRouter, Request, UploadFile, File, HTTPException
from app.models.schemas import TransactionInput, TransactionResult, CsvUploadResult
from app.warehouse.connection import get_connection
from app.ingestion.manual_scorer import score_single_transaction
from app.ingestion.csv_uploader import process_csv_upload
import pandas as pd
from app.config import PAYSIM_CSV_PATH
from app.intelligence.model_lab import warehouse_frame

router = APIRouter()

@router.post('/api/ingest/bundled')
async def ingest_bundled(request: Request):
    con = get_connection()
    existing, _ = warehouse_frame(con)
    columns = ['step','type','amount','orig_balance_delta','dest_balance_delta','label']
    signatures = {tuple(row) for row in existing[columns].fillna(-1).itertuples(index=False,name=None)}
    source = pd.read_csv(PAYSIM_CSV_PATH)
    keep = []
    for _, row in source.iterrows():
        signature = (row.step,row.type,row.amount,row.newbalanceOrig-row.oldbalanceOrg,
                     row.newbalanceDest-row.oldbalanceDest,row.isFraud if pd.notna(row.isFraud) else -1)
        if signature not in signatures:
            keep.append(row.to_dict())
            signatures.add(signature)
    if not keep:
        return {'total':len(source),'valid':0,'rejected':0,'already_present':len(source),
                'message':'All bundled sample signatures are already represented in the warehouse.'}
    result = await process_csv_upload(pd.DataFrame(keep).to_csv(index=False).encode(),
        request.app.state.classifier, request.app.state.drift_detector, con, source='Bundled PaySim sample')
    return {**result.model_dump(),'already_present':len(source)-len(keep),
            'message':'Missing bundled records loaded. Retrain explicitly in Model lab to use the expanded warehouse.'}

@router.post("/api/ingest/single", response_model=TransactionResult)
async def ingest_single(tx: TransactionInput, request: Request):
    app_state = request.app.state
    con = get_connection()
    try:
        result = await score_single_transaction(
            tx,
            app_state.classifier,
            app_state.drift_detector,
            con
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/ingest/csv", response_model=CsvUploadResult)
async def ingest_csv(request: Request, file: UploadFile = File(...)):
    app_state = request.app.state
    con = get_connection()
    try:
        content = await file.read()
        result = await process_csv_upload(
            content,
            app_state.classifier,
            app_state.drift_detector,
            con
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
