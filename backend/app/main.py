import time
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import DATA_DIR
from app.warehouse.connection import init_warehouse, close_connection
from app.warehouse.etl import populate_dim_time
from app.intelligence.stream_classifier import StreamClassifier
from app.intelligence.drift_detector import DriftDetector
from app.intelligence.model_lab import restore_or_train
from app.routes.learning import router as learning_router
from app.ingestion.stream_simulator import StreamSimulator

# Import routers
from app.routes.health import router as health_router
from app.routes.olap import router as olap_router
from app.routes.mining import router as mining_router
from app.routes.ingest import router as ingest_router
from app.routes.warehouse_admin import router as admin_router
from app.routes.stream_ws import router as ws_router
from app.routes.stream_control import router as stream_control_router
from app.routes.alerts import router as alerts_router
from app.auth import router as auth_router, request_user
from fastapi.responses import JSONResponse

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize warehouse
    con = init_warehouse()
    populate_dim_time(con)
    con.execute('CHECKPOINT')
    
    # Initialize global ML states
    app.state.classifier = StreamClassifier()
    restore_or_train(con, app.state.classifier)
    app.state.drift_detector = DriftDetector()
    
    # Initialize Simulator
    csv_path = os.path.join(DATA_DIR, "paysim.csv")
    # Touch file if not exists so it doesn't crash on startup
    if not os.path.exists(csv_path):
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(csv_path, 'w') as f:
            f.write("step,type,amount,nameOrig,oldbalanceOrg,newbalanceOrig,nameDest,oldbalanceDest,newbalanceDest,isFraud,isFlaggedFraud\n")
            
    app.state.simulator = StreamSimulator(csv_path)
    app.state.stream_task = None
    app.state.stream_speed = {'val': 200}
    app.state.stream_state = 'IDLE'
    app.state.start_time = time.time()
    
    yield
    
    close_connection()

app = FastAPI(title="SENTINEL Backend API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def protect_api(request, call_next):
    path = request.url.path
    if not path.startswith("/api/") or path in ("/api/health", "/api/auth/login", "/api/auth/me"):
        return await call_next(request)
    user = request_user(request)
    if not user:
        return JSONResponse({"detail": "Sign in required"}, status_code=401)
    role = user["role"]
    if path.startswith(("/api/warehouse", "/api/ingest", "/api/learning")) and role != "DATA_ENGINEER":
        return JSONResponse({"detail": "Engineer access required"}, status_code=403)
    if path == '/api/mining/rules' and role != 'DATA_ENGINEER':
        return JSONResponse({'detail':'Engineer access required'}, status_code=403)
    if path.startswith("/api/stream/control") and role == "BRANCH_MANAGER":
        return JSONResponse({"detail": "Investigator access required"}, status_code=403)
    return await call_next(request)

# Include routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(olap_router)
app.include_router(mining_router)
app.include_router(ingest_router)
app.include_router(admin_router)
app.include_router(ws_router)
app.include_router(stream_control_router)
app.include_router(alerts_router)
app.include_router(learning_router)
