from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from app.models.enums import TransactionType, OlapOperation, Granularity, StreamAction, StreamState

class TransactionInput(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    step: int = Field(ge=1, le=100000)
    type: TransactionType
    amount: float = Field(ge=0)
    oldbalanceOrg: float = Field(ge=0)
    newbalanceOrig: float = Field(ge=0)
    oldbalanceDest: float = Field(ge=0)
    newbalanceDest: float = Field(ge=0)
    nameOrig: str = 'C_MANUAL'
    nameDest: str = 'M_MANUAL'
    isFraud: Optional[int] = Field(default=None, ge=0, le=1)

class TransactionResult(BaseModel):
    tx_id: int
    fraud_probability: float
    verdict: int
    drift_detected: bool
    drift_id: Optional[int] = None
    latency_ms: float
    model_version: Optional[str] = None

class OlapQueryParams(BaseModel):
    operation: OlapOperation
    granularity: Granularity
    type_filter: Optional[TransactionType] = None
    type_filters: Optional[List[TransactionType]] = None
    fraud_only: bool = False
    is_night: Optional[bool] = None
    step_range_start: Optional[int] = None
    step_range_end: Optional[int] = None
    scope_start: Optional[int] = None
    scope_end: Optional[int] = None

class OlapResult(BaseModel):
    data: List[Dict[str, Any]]
    sql: str
    execution_ms: float

class MiningParams(BaseModel):
    drift_id: int = Field(ge=1)
    min_support: float = Field(gt=0, le=1)
    min_confidence: float = Field(gt=0, le=1)
    min_lift: float = Field(gt=0)
    window_size: int = Field(ge=10, le=500)

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
