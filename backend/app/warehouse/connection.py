import duckdb
from app.config import WAREHOUSE_PATH
from app.warehouse.ddl import create_schema

_conn = None

def get_connection():
    global _conn
    if _conn is None:
        WAREHOUSE_PATH.parent.mkdir(parents=True, exist_ok=True)
        _conn = duckdb.connect(str(WAREHOUSE_PATH))
    return _conn

def init_warehouse():
    conn = get_connection()
    create_schema(conn)
    return conn
