"""
auth.py — Authentication endpoints (register + login + verify).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.auth import register_user, login_user, verify_token

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenRequest(BaseModel):
    token: str


@router.post("/register")
async def register(req: RegisterRequest):
    try:
        result = register_user(req.email, req.name, req.password)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login")
async def login(req: LoginRequest):
    try:
        result = login_user(req.email, req.password)
        return result
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/verify")
async def verify(req: TokenRequest):
    payload = verify_token(req.token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return {"valid": True, "user": {"id": payload["sub"], "email": payload["email"], "name": payload["name"]}}
