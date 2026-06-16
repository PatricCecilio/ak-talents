from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse


def register_user(db: Session, payload: RegisterRequest) -> TokenResponse:
    if payload.role == UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin users cannot be created publicly")

    existing_user = db.query(User).filter(User.email == payload.email).first()

    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        name=payload.name,
        email=str(payload.email),
        hashed_password=get_password_hash(payload.password),
        role=payload.role.value,
    )
    db.add(user)
    db.flush()

    if payload.role == UserRole.company:
        db.add(Company(user_id=user.id, company_name=payload.company_name or payload.name))
    elif payload.role == UserRole.candidate:
        db.add(Candidate(user_id=user.id))

    db.commit()
    db.refresh(user)

    return TokenResponse(access_token=create_access_token(user.id), user=user)


def authenticate_user(db: Session, payload: LoginRequest) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    return TokenResponse(access_token=create_access_token(user.id), user=user)
