from fastapi import APIRouter, Depends, Form, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.core import messages
from app.core.rate_limit import LOGIN_LIMIT, REGISTER_LIMIT, limiter
from app.database.session import get_db
from app.schemas.auth import (
    GoogleCodeRequest,
    GoogleConsentRequest,
    GoogleSignInRequest,
    GoogleSignInResponse,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
)
from app.services.auth_service import ConsentRequiredError, authenticate_user, google_sign_in, register_user
from app.services.google_redirect_service import complete_with_consent, exchange_session_code, handle_google_redirect

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


# Google redirect mode: Google POSTs here (through the site's /auth/google/retorno/<door>, which keeps the visitor's
# cookies for the CSRF check). Always answers with a redirect back to the site.
@router.post("/google/redirect/{door}")
@limiter.limit(LOGIN_LIMIT)
def google_redirect(
    request: Request,
    door: str,
    credential: str = Form(default=""),
    g_csrf_token: str = Form(default=""),
    db: Session = Depends(get_db),
):
    target = handle_google_redirect(db, door, credential, g_csrf_token, request.cookies.get("g_csrf_token", ""))
    return RedirectResponse(target, status_code=status.HTTP_303_SEE_OTHER)


@router.post("/google/codigo", response_model=GoogleSignInResponse)
@limiter.limit(LOGIN_LIMIT)
def google_exchange_code(request: Request, payload: GoogleCodeRequest, db: Session = Depends(get_db)):
    return exchange_session_code(db, payload.codigo)


@router.post("/google/consentimento", response_model=GoogleSignInResponse)
@limiter.limit(LOGIN_LIMIT)
def google_consent(request: Request, payload: GoogleConsentRequest, db: Session = Depends(get_db)):
    return complete_with_consent(db, payload.codigo, payload.privacy_accepted)
