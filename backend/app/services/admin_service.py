from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.user import User, UserRole
from app.schemas.admin import (
    AdminApplicationRead,
    AdminCandidateRead,
    AdminCompanyRead,
    AdminJobRead,
    AdminUserRead,
)


def require_admin(current_user: User) -> None:
    if current_user.role != UserRole.admin.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


def _company_to_admin_read(company: Company) -> AdminCompanyRead:
    return AdminCompanyRead(
        id=company.id,
        user_id=company.user_id,
        company_name=company.company_name,
        responsible_name=company.responsible_name,
        email=company.user.email,
        city=company.city,
        state=company.state,
        industry=company.industry,
        company_size=company.company_size,
        status=company.status,
        created_at=company.created_at,
    )


def _job_to_admin_read(job: Job) -> AdminJobRead:
    return AdminJobRead(
        id=job.id,
        company_id=job.company_id,
        company_name=job.company.company_name,
        title=job.title,
        location=job.location,
        work_mode=job.work_mode,
        status=job.status,
        is_active=job.is_active,
        created_at=job.created_at,
    )


def list_admin_users(db: Session, current_user: User) -> list[AdminUserRead]:
    require_admin(current_user)
    return db.query(User).order_by(User.created_at.desc()).all()


def list_admin_candidates(db: Session, current_user: User) -> list[AdminCandidateRead]:
    require_admin(current_user)
    candidates = db.query(Candidate).join(Candidate.user).order_by(Candidate.created_at.desc()).all()
    return [
        AdminCandidateRead(
            id=candidate.id,
            user_id=candidate.user_id,
            name=candidate.full_name or candidate.user.name,
            email=candidate.user.email,
            city=candidate.city,
            desired_role=candidate.desired_role,
            skills=candidate.skills,
            experience_years=candidate.experience_years,
            salary_expectation=candidate.salary_expectation,
            work_mode=candidate.work_mode,
            created_at=candidate.created_at,
        )
        for candidate in candidates
    ]


def list_admin_companies(db: Session, current_user: User) -> list[AdminCompanyRead]:
    require_admin(current_user)
    companies = db.query(Company).join(Company.user).order_by(Company.created_at.desc()).all()
    return [_company_to_admin_read(company) for company in companies]


def list_admin_jobs(db: Session, current_user: User) -> list[AdminJobRead]:
    require_admin(current_user)
    jobs = db.query(Job).join(Job.company).order_by(Job.created_at.desc()).all()
    return [_job_to_admin_read(job) for job in jobs]


def list_admin_applications(db: Session, current_user: User) -> list[AdminApplicationRead]:
    require_admin(current_user)
    applications = (
        db.query(Application)
        .join(Application.candidate)
        .join(Application.job)
        .order_by(Application.created_at.desc())
        .all()
    )
    return [
        AdminApplicationRead(
            id=application.id,
            candidate_id=application.candidate_id,
            candidate_name=application.candidate.full_name or application.candidate.user.name,
            job_id=application.job_id,
            job_title=application.job.title,
            status=application.status,
            created_at=application.created_at,
        )
        for application in applications
    ]


def approve_company(db: Session, current_user: User, company_id: int) -> AdminCompanyRead:
    require_admin(current_user)
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    company.status = "approved"
    db.commit()
    db.refresh(company)
    return _company_to_admin_read(company)


def block_company(db: Session, current_user: User, company_id: int) -> AdminCompanyRead:
    require_admin(current_user)
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    company.status = "blocked"
    db.commit()
    db.refresh(company)
    return _company_to_admin_read(company)


def approve_job(db: Session, current_user: User, job_id: int) -> AdminJobRead:
    require_admin(current_user)
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    job.status = "approved"
    job.is_active = True
    db.commit()
    db.refresh(job)
    return _job_to_admin_read(job)


def hide_job(db: Session, current_user: User, job_id: int) -> AdminJobRead:
    require_admin(current_user)
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    job.status = "hidden"
    job.is_active = False
    db.commit()
    db.refresh(job)
    return _job_to_admin_read(job)
