from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import OlapQueryParams, OlapResult
from app.warehouse.connection import get_connection
from app.warehouse.olap_queries import (
    rollup_query,
    drilldown_query,
    slice_query,
    dice_query,
    pivot_query
)

router = APIRouter()

@router.post("/api/olap/query", response_model=OlapResult)
async def query_olap(params: OlapQueryParams):
    con = get_connection()
    try:
        op = params.operation.value if hasattr(params.operation, 'value') else str(params.operation)
        gran = params.granularity.value if hasattr(params.granularity, 'value') else str(params.granularity)
        type_flt = params.type_filter.value if hasattr(params.type_filter, 'value') and params.type_filter else (str(params.type_filter) if params.type_filter else None)
        if params.step_range_start is not None and params.step_range_start < 0:
            raise ValueError('Step start must be zero or greater')
        if params.step_range_end is not None and params.step_range_end < 1:
            raise ValueError('Step end must be at least one')
        if op != 'DRILLDOWN' and params.step_range_start is not None and params.step_range_end is not None and params.step_range_end < params.step_range_start:
            raise ValueError('Step end must be after step start')
        
        if op == "ROLLUP":
            data, sql, exec_ms = rollup_query(con, gran, type_flt, params.fraud_only, params.is_night, params.step_range_start, params.step_range_end)
        elif op == "DRILLDOWN":
            data, sql, exec_ms = drilldown_query(con, params.step_range_start if params.step_range_start is not None else 0, gran, type_flt, params.fraud_only, params.is_night)
        elif op == "SLICE":
            val = type_flt or "CASH_OUT"
            data, sql, exec_ms = slice_query(con, "type", val, gran)
        elif op == "DICE":
            types = [type_flt] if type_flt else ["TRANSFER", "CASH_OUT"]
            data, sql, exec_ms = dice_query(con, types, params.fraud_only, params.is_night, params.step_range_start, params.step_range_end, gran)
        else:
            data, sql, exec_ms = rollup_query(con, gran, type_flt, params.fraud_only, params.is_night, params.step_range_start, params.step_range_end)
            
        return OlapResult(data=data, sql=sql, execution_ms=round(exec_ms, 2))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/api/olap/pivot", response_model=OlapResult)
async def pivot_olap(
    row_dim: str = Query("day_of_week", description="Dimension for rows"),
    col_dim: str = Query("type_name", description="Dimension for columns"),
    measure: str = Query("sum_amount", description="Measure to aggregate")
):
    con = get_connection()
    try:
        data, sql, exec_ms = pivot_query(con, row_dim, col_dim, measure)
        return OlapResult(data=data, sql=sql, execution_ms=round(exec_ms, 2))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
