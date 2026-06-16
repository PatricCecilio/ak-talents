from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.admin import (
    AdminApplicationRead,
    AdminCandidateRead,
    AdminCompanyRead,
    AdminJobRead,
    AdminUserRead,
)
from app.services.admin_service import (
    approve_company,
    approve_job,
    block_company,
    hide_job,
    list_admin_applications,
    list_admin_candidates,
    list_admin_companies,
    list_admin_jobs,
    list_admin_users,
)

router = APIRouter()


@router.get("/users", response_model=list[AdminUserRead])
def get_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return list_admin_users(db, current_user)


@router.get("/candidates", response_model=list[AdminCandidateRead])
def get_candidates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return list_admin_candidates(db, current_user)


@router.get("/companies", response_model=list[AdminCompanyRead])
def get_companies(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return list_admin_companies(db, current_user)


@router.get("/jobs", response_model=list[AdminJobRead])
def get_jobs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return list_admin_jobs(db, current_user)


@router.get("/applications", response_model=list[AdminApplicationRead])
def get_applications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return list_admin_applications(db, current_user)


@router.put("/companies/{company_id}/approve", response_model=AdminCompanyRead)
def approve_company_endpoint(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return approve_company(db, current_user, company_id)


@router.put("/companies/{company_id}/block", response_model=AdminCompanyRead)
def block_company_endpoint(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return block_company(db, current_user, company_id)


@router.put("/jobs/{job_id}/approve", response_model=AdminJobRead)
def approve_job_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return approve_job(db, current_user, job_id)


@router.put("/jobs/{job_id}/hide", response_model=AdminJobRead)
def hide_job_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return hide_job(db, current_user, job_id)
