import duckdb
import shutil
from app.config import WAREHOUSE_PATH, WAREHOUSE_SEED_PATH
from app.warehouse.ddl import create_schema

_conn = None

def get_connection():
    global _conn
    if _conn is None:
        WAREHOUSE_PATH.parent.mkdir(parents=True, exist_ok=True)
        if not WAREHOUSE_PATH.exists() and WAREHOUSE_SEED_PATH.exists() and WAREHOUSE_PATH.resolve() != WAREHOUSE_SEED_PATH.resolve():
            shutil.copyfile(WAREHOUSE_SEED_PATH, WAREHOUSE_PATH)
        _conn = duckdb.connect(str(WAREHOUSE_PATH))
    return _conn

def init_warehouse():
    conn = get_connection()
    create_schema(conn)
    return conn

def close_connection():
    global _conn
    if _conn is not None:
        _conn.close()
        _conn = None
