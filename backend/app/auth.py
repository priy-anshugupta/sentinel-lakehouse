"""Small, server-validated demo identity layer.

Deployments should provide an external identity provider. The built-in accounts are
intentionally labelled demo accounts and can be disabled with SENTINEL_DEMO_AUTH=0.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from fastapi import APIRouter, HTTPException, Request, WebSocket
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth")
SECRET = os.getenv("SENTINEL_SESSION_SECRET") or secrets.token_hex(32)
DEMO_ENABLED = os.getenv("SENTINEL_DEMO_AUTH", "1") == "1"
PASSWORD = os.getenv("SENTINEL_DEMO_PASSWORD", "SentinelDemo!2026")
USERS = {
    "manager@sentinel.demo": ("BRANCH_MANAGER", "Branch Manager"),
    "investigator@sentinel.demo": ("FRAUD_INVESTIGATOR", "Fraud Investigator"),
    "engineer@sentinel.demo": ("DATA_ENGINEER", "Data Engineer"),
}
SALT = secrets.token_bytes(16)
PASSWORD_HASH = hashlib.pbkdf2_hmac("sha256", PASSWORD.encode(), SALT, 200_000)
FAILED = {}

class Credentials(BaseModel):
    email: str
    password: str

def _encode(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()

def _decode(value):
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))

def create_token(email):
    payload = _encode(json.dumps({"sub": email, "exp": int(time.time()) + 8 * 3600}).encode())
    signature = _encode(hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{signature}"

def resolve_token(token):
    try:
        payload, signature = token.split(".", 1)
        expected = _encode(hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            return None
        claims = json.loads(_decode(payload))
        if claims.get("exp", 0) < time.time() or claims.get("sub") not in USERS:
            return None
        email = claims["sub"]
        role, name = USERS[email]
        return {"email": email, "role": role, "name": name}
    except (ValueError, KeyError, TypeError):
        return None

def request_user(request: Request):
    header = request.headers.get("authorization", "")
    return resolve_token(header[7:]) if header.startswith("Bearer ") else None

def websocket_user(websocket: WebSocket):
    return resolve_token(websocket.query_params.get("token", ""))

@router.post("/login")
async def login(credentials: Credentials, request: Request):
    if not DEMO_ENABLED:
        raise HTTPException(503, "Demo authentication is disabled; configure an identity provider")
    ip = request.client.host if request.client else "unknown"
    attempts = [t for t in FAILED.get(ip, []) if time.time() - t < 300]
    if len(attempts) >= 8:
        raise HTTPException(429, "Too many attempts. Try again in five minutes.")
    email = credentials.email.strip().lower()
    candidate = hashlib.pbkdf2_hmac("sha256", credentials.password.encode(), SALT, 200_000)
    if email not in USERS or not hmac.compare_digest(candidate, PASSWORD_HASH):
        FAILED[ip] = attempts + [time.time()]
        raise HTTPException(401, "Invalid email or password")
    FAILED.pop(ip, None)
    role, name = USERS[email]
    return {"access_token": create_token(email), "user": {"email": email, "role": role, "name": name}}

@router.get("/me")
async def me(request: Request):
    user = request_user(request)
    if not user:
        raise HTTPException(401, "Session expired")
    return user
