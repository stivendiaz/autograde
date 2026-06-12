from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import create_token, hash_password, verify_password
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterPayload(BaseModel):
    name: str
    email: str
    password: str
    role: str = "student"


class LoginPayload(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(payload: RegisterPayload, db: Session = Depends(get_db)):
    if payload.role not in ("teacher", "student"):
        raise HTTPException(400, "Role must be 'teacher' or 'student'")
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(400, "Email already registered")
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user)
    return {
        "access_token": token,
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role},
    }


@router.post("/login")
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    token = create_token(user)
    return {
        "access_token": token,
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role},
    }
