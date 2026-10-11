from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core import messages
from app.core.names import normalize_person_name
from app.core.privacy import PRIVACY_CONSENT_REQUIRED_MESSAGE, PRIVACY_POLICY_VERSION
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.user import PUBLIC_SIGNUP_ROLES, STAFF_ROLES, User, UserRole
from app.services.google_auth import GoogleIdentity, verify_google_credential
from app.services.identity_service import normalize_email
from app.schemas.auth import GoogleSignInRequest, GoogleSignInResponse, LoginRequest, RegisterRequest, TokenResponse

DOOR_ROLES = {"candidato": UserRole.candidate, "empresa": UserRole.company}


class ConsentRequiredError(Exception):
    """A Google sign-in would create a new account, but the privacy policy was not accepted yet."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _find_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(func.lower(User.email) == email.strip().lower()).first()


def _create_account(
    db: Session,
    *,
    name: str,
    email: str,
    role: UserRole,
    hashed_password: str | None,
    company_name: str | None = None,
    google_sub: str | None = None,
) -> User:
    """Public sign-up (form or Google): the user, the LGPD consent and the empty profile of the account type."""
    # Candidates are people: "PATRIC CECILIO" is saved as "Patric Cecilio". Company names are kept as typed.
    display_name = normalize_person_name(name) if role == UserRole.candidate else name
    now = _now()
    user = User(
        name=display_name,
        email=email,
        hashed_password=hashed_password,
        role=role.value,
        privacy_accepted_at=now,
        privacy_policy_version=PRIVACY_POLICY_VERSION,
        google_sub=google_sub,
        email_verified_at=now if google_sub else None,
    )
    db.add(user)
    db.flush()

    if role == UserRole.company:
        # Same flow as the form: company "pending", profile to complete, jobs await approval.
        db.add(Company(user_id=user.id, company_name=company_name or display_name))
    elif role == UserRole.candidate:
        # Same e-mail on the candidate profile, so applications can be linked to the account.
        db.add(Candidate(user_id=user.id, full_name=display_name, email=normalize_email(user.email)))
    db.flush()
    return user


def register_user(db: Session, payload: RegisterRequest) -> TokenResponse:
    # Staff accounts (admin, recruiter) are only created by an admin, never on the public form.
    if payload.role.value not in PUBLIC_SIGNUP_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Este tipo de conta não pode ser criado pelo cadastro.")

    if not payload.privacy_accepted:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=PRIVACY_CONSENT_REQUIRED_MESSAGE)

    if _find_user_by_email(db, str(payload.email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=messages.EMAIL_ALREADY_REGISTERED)

    user = _create_account(
        db,
        name=payload.name,
        email=str(payload.email),
        role=payload.role,
        hashed_password=get_password_hash(payload.password),
        company_name=payload.company_name,
    )
    db.commit()
    db.refresh(user)

    return TokenResponse(access_token=create_access_token(user.id), user=user)


def authenticate_user(db: Session, payload: LoginRequest) -> TokenResponse:
    user = _find_user_by_email(db, str(payload.email))

    if user is not None and user.hashed_password is None:
        # Google-only account (or one whose old password was invalidated when Google was linked).
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=messages.GOOGLE_ONLY_ACCOUNT)

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=messages.INVALID_CREDENTIALS)

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=messages.INACTIVE_USER)

    return TokenResponse(access_token=create_access_token(user.id), user=user)


def link_public_applications(db: Session, user: User) -> int:
    """Moves public job-form applications made with this account's e-mail into the account.

    Only called after Google proved the e-mail belongs to this person. Profile data is never changed, and an
    application to a job the account already applied to stays where it is (one application per job).
    """
    if user.role != UserRole.candidate.value or user.email_verified_at is None:
        return 0
    account_candidate = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    if account_candidate is None:
        return 0

    email = user.email.strip().lower()
    orphans = (
        db.query(Candidate)
        .filter(Candidate.user_id.is_(None), Candidate.id != account_candidate.id, func.lower(Candidate.email) == email)
        .all()
    )
    applied_jobs = {
        job_id for (job_id,) in db.query(Application.job_id).filter(Application.candidate_id == account_candidate.id)
    }
    moved = 0
    for orphan in orphans:
        for application in db.query(Application).filter(Application.candidate_id == orphan.id).all():
            if application.job_id in applied_jobs:
                continue
            application.candidate_id = account_candidate.id
            applied_jobs.add(application.job_id)
            moved += 1
    db.flush()
    return moved


def _link_google(user: User, identity: GoogleIdentity) -> None:
    # Google proved the e-mail; the old password may have been set by someone who registered this e-mail without
    # owning it, so it stops working and every session opened before now is closed.
    now = _now()
    user.google_sub = identity.sub
    user.email_verified_at = user.email_verified_at or now
    user.hashed_password = None
    # Whole seconds: JWT "iat" has second precision, so the session issued right now stays valid.
    user.sessions_valid_after = now.replace(microsecond=0)


def google_sign_in(db: Session, payload: GoogleSignInRequest) -> GoogleSignInResponse:
    identity = verify_google_credential(payload.credential)

    user = db.query(User).filter(User.google_sub == identity.sub).first()
    linked = created = False

    if user is None:
        user = _find_user_by_email(db, identity.email)
        if user is not None:
            # Team accounts never sign in with Google: they keep e-mail + password at /equipe.
            if user.role in STAFF_ROLES:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=messages.GOOGLE_STAFF_USE_TEAM_LOGIN)
            if user.google_sub and user.google_sub != identity.sub:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=messages.GOOGLE_OTHER_ACCOUNT)
            if not user.is_active:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=messages.INACTIVE_USER)
            _link_google(user, identity)
            linked = True
        else:
            if not payload.privacy_accepted:
                raise ConsentRequiredError()
            user = _create_account(
                db,
                name=identity.name,
                email=identity.email,
                role=DOOR_ROLES[payload.door],
                hashed_password=None,
                google_sub=identity.sub,
            )
            created = True

    if user.role in STAFF_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=messages.GOOGLE_STAFF_USE_TEAM_LOGIN)
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=messages.INACTIVE_USER)

    moved = link_public_applications(db, user)
    db.commit()
    db.refresh(user)
    return GoogleSignInResponse(
        access_token=create_access_token(user.id),
        user=user,
        created=created,
        linked=linked,
        linked_applications=moved,
    )
