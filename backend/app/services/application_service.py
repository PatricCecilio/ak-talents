from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.user import User, UserRole
from app.schemas.application import ApplicationCreate


def create_application(db: Session, current_user: User, payload: ApplicationCreate) -> Application:
    if current_user.role != UserRole.candidate.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only candidates can apply to jobs")

    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.id).first()

    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate profile not found")

    job = db.query(Job).filter(Job.id == payload.job_id, Job.is_active.is_(True), Job.status == "approved").first()

    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    existing_application = (
        db.query(Application)
        .filter(Application.candidate_id == candidate.id, Application.job_id == payload.job_id)
        .first()
    )

    if existing_application:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Application already exists")

    application = Application(candidate_id=candidate.id, **payload.model_dump())
    db.add(application)
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
