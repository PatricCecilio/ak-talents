"""Client companies and their jobs, operated by the AK admin (the client no longer uses the system).

Companies are internal records (no login needed). Jobs opened here skip the old approval step: the admin chooses
draft, published ("approved", the only public status) or closed.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core import messages
from app.models.company import Company
from app.models.job import Job
from app.models.user import STAFF_ROLES, User
from app.schemas.admin import AdminJobDetail, AdminJobWrite, CompanyWrite
from app.services.identity_service import normalize_email, normalize_phone
from app.services.slug_service import generate_unique_job_slug

INVALID_RECRUITER = "Escolha um recrutador ativo da equipe AK Talent."


def _unprocessable(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


def _company_or_404(db: Session, company_id: int) -> Company:
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=messages.COMPANY_NOT_FOUND)
    return company


def _job_or_404(db: Session, job_id: int) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=messages.JOB_NOT_FOUND)
    return job


def _apply_company_fields(company: Company, payload: CompanyWrite) -> None:
    cnpj = normalize_phone(payload.cnpj) if payload.cnpj else None  # digits only
    if cnpj is not None and len(cnpj) != 14:
        raise _unprocessable(messages.INVALID_CNPJ)
    whatsapp = normalize_phone(payload.whatsapp)
    if not 10 <= len(whatsapp) <= 13:
        raise _unprocessable(messages.INVALID_WHATSAPP)

    company.company_name = payload.company_name
    company.cnpj = cnpj
    company.responsible_name = payload.responsible_name
    company.phone = whatsapp
    company.contact_email = normalize_email(str(payload.contact_email)) if payload.contact_email else None
    company.city = payload.city
    company.state = payload.state.upper() if payload.state else None
    company.notes = payload.notes


def create_company(db: Session, payload: CompanyWrite) -> Company:
    # Internal record: no account, nothing to approve.
    company = Company(user_id=None, company_name=payload.company_name, status="approved", is_active=True)
    _apply_company_fields(company, payload)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def update_company(db: Session, company_id: int, payload: CompanyWrite) -> Company:
    company = _company_or_404(db, company_id)
    _apply_company_fields(company, payload)
    db.commit()
    db.refresh(company)
    return company


def _check_recruiter(db: Session, recruiter_id: int | None) -> None:
    if recruiter_id is None:
        return
    member = db.get(User, recruiter_id)
    if member is None or member.role not in STAFF_ROLES or not member.is_active:
        raise _unprocessable(INVALID_RECRUITER)


def _apply_job_fields(db: Session, job: Job, payload: AdminJobWrite) -> None:
    company = _company_or_404(db, payload.company_id)
    # A deactivated company keeps its old jobs, but gets no new or moved ones.
    if not company.is_active and job.company_id != company.id:
        raise _unprocessable(messages.INACTIVE_COMPANY)
    _check_recruiter(db, payload.recruiter_id)

    for field, value in payload.model_dump(exclude={"company_id", "recruiter_id", "status"}).items():
        setattr(job, field, value)
    job.company_id = company.id
    job.recruiter_id = payload.recruiter_id
    job.status = payload.status
    # Only published jobs are active; closing a job takes it off the site.
    job.is_active = payload.status != "closed"


def create_admin_job(db: Session, payload: AdminJobWrite) -> Job:
    job = Job(slug=generate_unique_job_slug(db, payload.title))
    _apply_job_fields(db, job, payload)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def update_admin_job(db: Session, job_id: int, payload: AdminJobWrite) -> Job:
    job = _job_or_404(db, job_id)
    # The slug (public link) never changes, even if the title does: links already shared keep working.
    _apply_job_fields(db, job, payload)
    db.commit()
    db.refresh(job)
    return job


def get_admin_job(db: Session, job_id: int) -> AdminJobDetail:
    job = _job_or_404(db, job_id)
    fields = {field: getattr(job, field) for field in AdminJobDetail.model_fields if field != "company_name"}
    return AdminJobDetail(**fields, company_name=job.company.company_name)
