from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core import messages
from app.models.company import Company
from app.models.job import Job
from app.models.user import User, UserRole
from app.schemas.job import JobCreate
from app.services.screening_service import list_public_screening_questions
from app.services.slug_service import generate_unique_job_slug


def create_job(db: Session, current_user: User, payload: JobCreate) -> Job:
    if current_user.role != UserRole.company.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=messages.COMPANIES_ONLY)

    company = db.query(Company).filter(Company.user_id == current_user.id).first()

    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=messages.COMPANY_PROFILE_NOT_FOUND)

    if company.status == "blocked":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=messages.BLOCKED_COMPANY)

    job = Job(company_id=company.id, slug=generate_unique_job_slug(db, payload.title), **payload.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def list_company_jobs(db: Session, current_user: User) -> list[Job]:
    """All jobs of the signed-in company, in any status (pending, approved, hidden)."""
    if current_user.role != UserRole.company.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas empresas podem ver as próprias vagas.")

    company = db.query(Company).filter(Company.user_id == current_user.id).first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil da empresa não encontrado.")

    return db.query(Job).filter(Job.company_id == company.id).order_by(Job.created_at.desc(), Job.id.desc()).all()


def publishable_jobs(db: Session):
    """Jobs candidates may see and apply to: approved, active and from an active (not deactivated) company."""
    return (
        db.query(Job)
        .join(Company, Job.company_id == Company.id)
        .join(User, Company.user_id == User.id)
        .filter(Job.is_active.is_(True), Job.status == "approved", User.is_active.is_(True))
    )


def list_jobs(db: Session) -> list[Job]:
    return publishable_jobs(db).order_by(Job.created_at.desc()).all()


def get_public_job_by_slug(db: Session, slug: str) -> Job:
    job = publishable_jobs(db).filter(Job.slug == slug).first()

    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=messages.JOB_NOT_FOUND)

    return job


def public_job_to_read(db: Session, job: Job) -> dict:
    return {
        "id": job.id,
        "slug": job.slug,
        "title": job.title,
        "description": job.description,
        "requirements": job.requirements,
        "salary_min": job.salary_min,
        "salary_max": job.salary_max,
        "location": job.location,
        "work_mode": job.work_mode,
        "schedule": job.schedule,
        "benefits": job.benefits,
        "contract_type": job.contract_type,
        "openings": job.openings,
        "created_at": job.created_at,
        "screening_questions": list_public_screening_questions(db, job.id),
    }
