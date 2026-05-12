"""Auth Router — Register & Login."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, TokenResponse, UserResponse
from app.services.auth_service import hash_password, verify_password, create_token

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
def register(req: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=req.email, name=req.name, hashed_password=hash_password(req.password), role="sales")
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.id, user.role)
    user_resp = UserResponse(id=str(user.id), email=user.email, name=user.name, role=user.role, is_active=user.is_active, created_at=user.created_at)
    return TokenResponse(access_token=token, user=user_resp)


@router.post("/login", response_model=TokenResponse)
def login(req: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    token = create_token(user.id, user.role)
    user_resp = UserResponse(id=str(user.id), email=user.email, name=user.name, role=user.role, is_active=user.is_active, created_at=user.created_at)
    return TokenResponse(access_token=token, user=user_resp)
