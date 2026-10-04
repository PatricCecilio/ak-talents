from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.database.session import get_db
from app.models.user import User, UserRole
from app.schemas.company import CompanyProfileRead, CompanyProfileUpdate
from app.schemas.job import JobRead
from app.schemas.company_pipeline import CompanyFinalist, CompanyFinalistsResponse, CompanyJobRead, FinalistDecision
from app.services.company_finalist_service import company_stage_counts, decide_finalist, list_company_finalists
from app.services.job_service import list_company_jobs
from app.services.profile_service import get_company_profile, update_company_profile

router = APIRouter()

company_only = require_role(UserRole.company)


@router.get("/me", response_model=CompanyProfileRead)
def get_my_company_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_company_profile(db, current_user)


@router.put("/me", response_model=CompanyProfileRead)
def update_my_company_profile(
    payload: CompanyProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_company_profile(db, current_user, payload)


@router.get("/me/jobs", response_model=list[CompanyJobRead])
def list_my_company_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(company_only),
):
    jobs = list_company_jobs(db, current_user)
    counts = company_stage_counts(db, [job.id for job in jobs])
    return [CompanyJobRead(**JobRead.model_validate(job).model_dump(), stage_counts=counts[job.id]) for job in jobs]


@router.get("/me/finalists", response_model=CompanyFinalistsResponse)
def list_my_finalists(db: Session = Depends(get_db), current_user: User = Depends(company_only)):
    return list_company_finalists(db, current_user)


@router.post("/me/finalists/{application_id}/decision", response_model=CompanyFinalist)
def decide_my_finalist(
    application_id: int,
    payload: FinalistDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(company_only),
):
    return decide_finalist(db, current_user, application_id, payload)
