import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
WAREHOUSE_PATH = DATA_DIR / "sentinel_warehouse.duckdb"
PAYSIM_CSV_PATH = DATA_DIR / "paysim.csv"

# Stream defaults
BATCH_SIZE = 50
DEFAULT_SPEED = 200

# Mining defaults
MIN_SUPPORT = 0.01
MIN_CONFIDENCE = 0.5
MIN_LIFT = 1.5
WINDOW_SIZE = 200

# ADWIN config
ADWIN_DELTA = 0.002

# Drift injection
DRIFT_INJECTION_POINT_DEFAULT = 350
