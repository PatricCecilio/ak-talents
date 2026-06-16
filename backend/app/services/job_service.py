from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.job import Job
from app.models.user import User, UserRole
from app.schemas.job import JobCreate


def create_job(db: Session, current_user: User, payload: JobCreate) -> Job:
    if current_user.role != UserRole.company.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only companies can create jobs")

    company = db.query(Company).filter(Company.user_id == current_user.id).first()

    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company profile not found")

    if company.status == "blocked":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Blocked companies cannot create jobs")

    job = Job(company_id=company.id, **payload.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def list_jobs(db: Session) -> list[Job]:
    return (
        db.query(Job)
        .filter(Job.is_active.is_(True), Job.status == "approved")
        .order_by(Job.created_at.desc())
        .all()
    )
