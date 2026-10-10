from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core import messages
from app.core.names import normalize_person_name
from app.core.privacy import PRIVACY_CONSENT_REQUIRED_MESSAGE, PRIVACY_POLICY_VERSION
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.user import PUBLIC_SIGNUP_ROLES, User, UserRole
from app.services.identity_service import normalize_email
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse


def register_user(db: Session, payload: RegisterRequest) -> TokenResponse:
    # Staff accounts (admin, recruiter) are only created by an admin, never on the public form.
    if payload.role.value not in PUBLIC_SIGNUP_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Este tipo de conta não pode ser criado pelo cadastro.")

    if not payload.privacy_accepted:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=PRIVACY_CONSENT_REQUIRED_MESSAGE)

    existing_user = db.query(User).filter(User.email == payload.email).first()

    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=messages.EMAIL_ALREADY_REGISTERED)

    # Candidates are people: "PATRIC CECILIO" is saved as "Patric Cecilio". Company names are kept as typed.
    name = normalize_person_name(payload.name) if payload.role == UserRole.candidate else payload.name
    user = User(
        name=name,
        email=str(payload.email),
        hashed_password=get_password_hash(payload.password),
        role=payload.role.value,
        privacy_accepted_at=datetime.now(timezone.utc),
        privacy_policy_version=PRIVACY_POLICY_VERSION,
    )
    db.add(user)
    db.flush()

    if payload.role == UserRole.company:
        db.add(Company(user_id=user.id, company_name=payload.company_name or payload.name))
    elif payload.role == UserRole.candidate:
        # Same e-mail on the candidate profile, so a later application through the public job form
        # (same e-mail) is linked to this account and shows up in "Minhas candidaturas".
        db.add(Candidate(user_id=user.id, full_name=name, email=normalize_email(user.email)))

    db.commit()
    db.refresh(user)

    return TokenResponse(access_token=create_access_token(user.id), user=user)


def authenticate_user(db: Session, payload: LoginRequest) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha inválidos.")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário inativo.")

    return TokenResponse(access_token=create_access_token(user.id), user=user)
