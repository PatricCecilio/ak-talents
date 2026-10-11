from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core import messages
from app.core.rate_limit import LOGIN_LIMIT, REGISTER_LIMIT, limiter
from app.database.session import get_db
from app.schemas.auth import GoogleSignInRequest, GoogleSignInResponse, LoginRequest, RegisterRequest, TokenResponse
from app.services.auth_service import ConsentRequiredError, authenticate_user, google_sign_in, register_user

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(REGISTER_LIMIT)
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    return register_user(db, payload)


@router.post("/login", response_model=TokenResponse)
@limiter.limit(LOGIN_LIMIT)
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    return authenticate_user(db, payload)


@router.post("/google", response_model=GoogleSignInResponse)
@limiter.limit(LOGIN_LIMIT)
def login_with_google(request: Request, payload: GoogleSignInRequest, db: Session = Depends(get_db)):
    try:
        return google_sign_in(db, payload)
    except ConsentRequiredError:
        # New account: the page asks for the privacy consent and sends the same Google credential again.
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": messages.GOOGLE_CONSENT_REQUIRED, "code": "consent_required"},
        )
