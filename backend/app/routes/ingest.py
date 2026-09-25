from fastapi import APIRouter, Request, UploadFile, File, HTTPException
from app.models.schemas import TransactionInput, TransactionResult, CsvUploadResult
from app.warehouse.connection import get_connection
from app.ingestion.manual_scorer import score_single_transaction
from app.ingestion.csv_uploader import process_csv_upload

router = APIRouter()

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
