"""Sign in with Google, redirect mode (all browsers; the popup hangs on phones).

Google POSTs the ID token to https://www.aktalent.com.br/auth/google/retorno/<door>; the site's vercel.json forwards
it here with the visitor's cookies. We check the double-submit CSRF token (cookie == form field), verify the ID token,
apply the same account rules as the JSON flow and send the browser back to the site with a ONE-TIME code (never the
session token itself in a URL). The site exchanges the code for the session with a POST.
"""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core import messages
from app.core.config import settings
from app.core.security import create_access_token
from app.models.login_code import LoginCode
from app.models.user import User
from app.schemas.auth import GoogleSignInResponse
from app.services.auth_service import ConsentRequiredError, resolve_google_account
from app.services.google_auth import GoogleIdentity, verify_google_credential

DOORS = ("candidato", "empresa")
SESSION_CODE_TTL = timedelta(seconds=60)
# Time to read the privacy policy and accept it.
CONSENT_CODE_TTL = timedelta(minutes=15)

# Refusal message -> short code in the URL; the site shows the matching Portuguese text.
ERROR_CODES = {
    messages.GOOGLE_STAFF_USE_TEAM_LOGIN: "equipe",
    messages.INACTIVE_USER: "inativo",
    messages.GOOGLE_OTHER_ACCOUNT: "outra_conta",
    messages.GOOGLE_EMAIL_NOT_VERIFIED: "email_nao_verificado",
    messages.GOOGLE_LOGIN_UNAVAILABLE: "indisponivel",
    messages.GOOGLE_TOKEN_INVALID: "token",
    messages.COMPANY_PORTAL_CLOSED: "empresa",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def _site_url(path: str, **params: str) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}{path}" + (f"?{urlencode(params)}" if params else "")


def _issue_code(db: Session, *, purpose: str, door: str, ttl: timedelta, **fields) -> str:
    code = secrets.token_urlsafe(32)
    db.add(LoginCode(code_hash=_hash(code), purpose=purpose, door=door, expires_at=_now() + ttl, **fields))
    db.commit()
    return code


def _error_redirect(door: str, error: str) -> str:
    # Company refusals go to the chooser: the company door itself is closed while the portal is off.
    path = "/entrar" if error == "empresa" else f"/entrar/{door}"
    return _site_url(path, erro=error)


def handle_google_redirect(db: Session, door: str, credential: str, csrf_form: str, csrf_cookie: str) -> str:
    """Returns the site URL to send the browser to (always a redirect, never an error page)."""
    if door not in DOORS:
        door = "candidato"
    # Double-submit check required by Google for the redirect mode.
    if not csrf_form or not csrf_cookie or not hmac.compare_digest(csrf_form, csrf_cookie):
        return _error_redirect(door, "csrf")
    if not credential:
        return _error_redirect(door, "token")

    try:
        identity = verify_google_credential(credential)
        result = resolve_google_account(db, identity, door, privacy_accepted=False)
    except ConsentRequiredError:
        code = _issue_code(
            db,
            purpose="consent",
            door=door,
            ttl=CONSENT_CODE_TTL,
            google_sub=identity.sub,
            email=identity.email,
            name=identity.name,
        )
        return _site_url("/entrar/google", consentimento=code)
    except HTTPException as exc:
        return _error_redirect(door, ERROR_CODES.get(str(exc.detail), "token"))

    code = _issue_code(
        db,
        purpose="session",
        door=door,
        ttl=SESSION_CODE_TTL,
        user_id=result.user.id,
        created_account=result.created,
        linked_account=result.linked,
        linked_applications=result.linked_applications,
    )
    return _site_url("/entrar/google", codigo=code)


def _consume(db: Session, code: str, purpose: str) -> LoginCode:
    row = db.query(LoginCode).filter(LoginCode.code_hash == _hash(code or "")).first()
    expires_at = row.expires_at if row else None
    if expires_at is not None and expires_at.tzinfo is None:  # SQLite returns naive UTC
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if row is None or row.purpose != purpose or row.used_at is not None or expires_at is None or expires_at < _now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=messages.GOOGLE_CODE_INVALID)
    row.used_at = _now()
    db.flush()
    return row


def exchange_session_code(db: Session, code: str) -> GoogleSignInResponse:
    row = _consume(db, code, "session")
    user = db.get(User, row.user_id) if row.user_id else None
    if user is None or not user.is_active:
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=messages.GOOGLE_CODE_INVALID)
    db.commit()
    return GoogleSignInResponse(
        access_token=create_access_token(user.id),
        user=user,
        created=row.created_account,
        linked=row.linked_account,
        linked_applications=row.linked_applications,
        door=row.door,
    )


def complete_with_consent(db: Session, code: str, privacy_accepted: bool) -> GoogleSignInResponse:
    if not privacy_accepted:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=messages.GOOGLE_CONSENT_REQUIRED)
    row = _consume(db, code, "consent")
    identity = GoogleIdentity(sub=row.google_sub or "", email=row.email or "", name=row.name or "")
    door = row.door
    db.commit()
    # Same rules as the first try: the account may have appeared meanwhile (then it is linked, not duplicated).
    result = resolve_google_account(db, identity, door, privacy_accepted=True)
    return GoogleSignInResponse(
        access_token=create_access_token(result.user.id),
        user=result.user,
        created=result.created,
        linked=result.linked,
        linked_applications=result.linked_applications,
        door=door,
    )
