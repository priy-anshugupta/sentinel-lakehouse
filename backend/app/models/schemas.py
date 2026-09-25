from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.models.enums import TransactionType, OlapOperation, Granularity, StreamAction, StreamState

class TransactionInput(BaseModel):
    step: int
    type: TransactionType
    amount: float
    oldbalanceOrg: float
    newbalanceOrig: float
    oldbalanceDest: float
    newbalanceDest: float
    isFraud: Optional[int] = None

class TransactionResult(BaseModel):
    tx_id: int
    fraud_probability: float
    verdict: int
    drift_detected: bool
    latency_ms: float

class OlapQueryParams(BaseModel):
    operation: OlapOperation
    granularity: Granularity
    type_filter: Optional[TransactionType] = None
    fraud_only: bool = False
    is_night: Optional[bool] = None
    step_range_start: Optional[int] = None
    step_range_end: Optional[int] = None

class OlapResult(BaseModel):
    data: List[Dict[str, Any]]
    sql: str
    execution_ms: float

class MiningParams(BaseModel):
    drift_id: int
    min_support: float
    min_confidence: float
    min_lift: float
    window_size: int

class RuleDiffResult(BaseModel):
    emerged: List[Dict[str, Any]]
    extinct: List[Dict[str, Any]]
    shifted: List[Dict[str, Any]]
    summary: Dict[str, Any]

class DriftEvent(BaseModel):
    drift_id: int
    detected_at_step: int
    error_rate_before: float
    error_rate_after: float
    is_injected: bool
    rules_summary: Dict[str, Any]

class StreamControlAction(BaseModel):
    action: StreamAction
    speed: Optional[int] = None

class StreamStatus(BaseModel):
    state: StreamState
    current_step: int
    speed: int
    total_processed: int

class KPIMetrics(BaseModel):
    total_tx: int
    fraud_rate: float
    accuracy: float
    f1: float
    drift_count: int
    warehouse_mb: float

class WarehouseTableStats(BaseModel):
    name: str
    rows: int
    size_mb: float

class DataQualityCheck(BaseModel):
    name: str
    status: str
    detail: str

class CsvUploadResult(BaseModel):
    total: int
    valid: int
    rejected: int
    fraud_flagged: int
    drift_triggered: int
