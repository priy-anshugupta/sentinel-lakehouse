from fastapi import APIRouter, HTTPException
from app.warehouse.connection import get_connection
from app.warehouse.data_quality import run_quality_checks

router = APIRouter()

@router.get("/api/warehouse/stats")
async def get_warehouse_stats():
    con = get_connection()
    try:
        tables = con.execute("SHOW TABLES").fetchall()
        stats = []
        for table in tables:
            table_name = table[0]
            count = con.execute(f"SELECT count(*) FROM {table_name}").fetchone()[0]
            stats.append({"table": table_name, "row_count": count})
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/warehouse/schema")
async def get_warehouse_schema():
    con = get_connection()
    try:
        tables = con.execute("SHOW TABLES").fetchall()
        schema = {}
        for table in tables:
            table_name = table[0]
            cols = con.execute(f"DESCRIBE {table_name}").fetchall()
            schema[table_name] = [{"name": c[0], "type": c[1]} for c in cols]
        return schema
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/warehouse/quality")
async def get_warehouse_quality():
    con = get_connection()
    try:
        results = run_quality_checks(con)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
