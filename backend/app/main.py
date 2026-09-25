import time
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import DATA_DIR
from app.warehouse.connection import init_warehouse
from app.warehouse.etl import populate_dim_time
from app.intelligence.stream_classifier import StreamClassifier
from app.intelligence.drift_detector import DriftDetector
from app.ingestion.stream_simulator import StreamSimulator

# Import routers
from app.routes.health import router as health_router
from app.routes.olap import router as olap_router
from app.routes.mining import router as mining_router
from app.routes.ingest import router as ingest_router
from app.routes.warehouse_admin import router as admin_router
from app.routes.stream_ws import router as ws_router
from app.routes.stream_control import router as stream_control_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize warehouse
    con = init_warehouse()
    populate_dim_time(con)
    
    # Initialize global ML states
    app.state.classifier = StreamClassifier()
    app.state.drift_detector = DriftDetector()
    
    # Initialize Simulator
    csv_path = os.path.join(DATA_DIR, "paysim.csv")
    # Touch file if not exists so it doesn't crash on startup
    if not os.path.exists(csv_path):
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(csv_path, 'w') as f:
            f.write("step,type,amount,nameOrig,oldbalanceOrg,newbalanceOrig,nameDest,oldbalanceDest,newbalanceDest,isFraud,isFlaggedFraud\n")
            
    app.state.simulator = StreamSimulator(csv_path)
    app.state.start_time = time.time()
    
    yield
    
    # Cleanup logic if any
    pass

app = FastAPI(title="SENTINEL Backend API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)
app.include_router(olap_router)
app.include_router(mining_router)
app.include_router(ingest_router)
app.include_router(admin_router)
app.include_router(ws_router)
app.include_router(stream_control_router)
