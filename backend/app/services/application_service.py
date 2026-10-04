from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.privacy import PRIVACY_CONSENT_REQUIRED_MESSAGE, PRIVACY_POLICY_VERSION
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.user import User, UserRole
from app.schemas.application import ApplicationCreate, PublicApplicationCreate, PublicApplicationRead
from app.services.identity_service import normalize_email, normalize_phone
from app.services.job_service import publishable_jobs
from app.services.pipeline_service import record_initial_stage
from app.services.token_service import generate_public_token, hash_public_token


PUBLIC_APPLICATION_STATUS = "pending_screening"


def create_application(db: Session, current_user: User, payload: ApplicationCreate) -> Application:
    if current_user.role != UserRole.candidate.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only candidates can apply to jobs")

    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.id).first()

    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate profile not found")

    job = publishable_jobs(db).filter(Job.id == payload.job_id).first()

    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    existing_application = (
        db.query(Application)
        .filter(Application.candidate_id == candidate.id, Application.job_id == payload.job_id)
        .first()
    )

    if existing_application:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Application already exists")

    # Account applications skip the automated screening and go straight to the AK team ("Nova").
    application = Application(
        candidate_id=candidate.id,
        **payload.model_dump(),
        screening_status="REVIEW",
        screening_summary="Sem triagem automática (candidatura com conta). A equipe AK Talent vai analisar.",
        privacy_accepted_at=current_user.privacy_accepted_at,
        privacy_policy_version=current_user.privacy_policy_version,
    )
    db.add(application)
    db.flush()
    record_initial_stage(db, application, note="Candidatura com conta.")
    db.commit()
    db.refresh(application)
    return application


def list_applications(db: Session, current_user: User) -> list[Application]:
    if current_user.role == UserRole.candidate.value:
        candidate = db.query(Candidate).filter(Candidate.user_id == current_user.id).first()
        if not candidate:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate profile not found")

        return (
            db.query(Application)
            .filter(Application.candidate_id == candidate.id)
            .order_by(Application.created_at.desc())
            .all()
        )

    if current_user.role == UserRole.company.value:
        company = db.query(Company).filter(Company.user_id == current_user.id).first()
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company profile not found")

        return (
            db.query(Application)
            .join(Job, Application.job_id == Job.id)
            .filter(Job.company_id == company.id)
            .order_by(Application.created_at.desc())
            .all()
        )

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unsupported user role")


def _find_candidate_by_phone(db: Session, normalized_phone: str) -> Candidate | None:
    candidates = db.query(Candidate).filter(Candidate.phone.isnot(None)).all()
    return next(
        (candidate for candidate in candidates if normalize_phone(candidate.phone or "") == normalized_phone),
        None,
    )


def _resolve_public_candidate(
    db: Session,
    payload: PublicApplicationCreate,
    normalized_email: str,
    normalized_phone: str,
) -> Candidate:
    candidate_by_email = db.query(Candidate).filter(Candidate.email == normalized_email).first()
    candidate_by_phone = _find_candidate_by_phone(db, normalized_phone)

    if candidate_by_email and candidate_by_phone and candidate_by_email.id != candidate_by_phone.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Nao foi possivel confirmar sua identidade com os dados informados.",
        )

    candidate = candidate_by_email or candidate_by_phone

    if candidate and candidate.email and candidate.email != normalized_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Nao foi possivel confirmar sua identidade com os dados informados.",
        )

    if candidate and candidate.phone and normalize_phone(candidate.phone) != normalized_phone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Nao foi possivel confirmar sua identidade com os dados informados.",
        )

    if candidate:
        # Fill only what is still empty (never overwrite). This also completes the contact data of an
        # account holder applying through the public form, so the AK team and, after approval, the
        # client company can reach them.
        candidate.full_name = candidate.full_name or payload.full_name.strip()
        candidate.email = candidate.email or normalized_email
        candidate.phone = candidate.phone or normalized_phone
        candidate.city = candidate.city or payload.city.strip()
        candidate.neighborhood = candidate.neighborhood or payload.neighborhood.strip()
        return candidate

    candidate = Candidate(
        full_name=payload.full_name.strip(),
        email=normalized_email,
        phone=normalized_phone,
        city=payload.city.strip(),
        neighborhood=payload.neighborhood.strip(),
    )
    db.add(candidate)
    db.flush()
    return candidate


def create_public_application(
    db: Session,
    slug: str,
    payload: PublicApplicationCreate,
) -> PublicApplicationRead:
    if not payload.privacy_accepted:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=PRIVACY_CONSENT_REQUIRED_MESSAGE)

    normalized_email = normalize_email(str(payload.email))
    normalized_phone = normalize_phone(payload.phone)

    if len(normalized_phone) < 8 or len(normalized_phone) > 15:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid phone")

    job = publishable_jobs(db).filter(Job.slug == slug).first()

    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    candidate = _resolve_public_candidate(db, payload, normalized_email, normalized_phone)

    existing_application = (
        db.query(Application)
        .filter(Application.candidate_id == candidate.id, Application.job_id == job.id)
        .first()
    )

    if existing_application:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Application already exists")

    application = Application(
        candidate_id=candidate.id,
        job_id=job.id,
        status=PUBLIC_APPLICATION_STATUS,
        privacy_accepted_at=datetime.now(timezone.utc),
        privacy_policy_version=PRIVACY_POLICY_VERSION,
    )
    public_screening_token = generate_public_token()
    application.public_screening_token_hash = hash_public_token(public_screening_token)
    db.add(application)
    db.flush()
    record_initial_stage(db, application, note="Candidatura pelo site.")
    db.commit()
    db.refresh(application)

    return PublicApplicationRead(
        status=application.status,
        screening_status=application.screening_status,
        public_screening_token=public_screening_token,
        application_reference=application.appintelli_reference,
        message="Candidatura recebida com sucesso.",
    )
