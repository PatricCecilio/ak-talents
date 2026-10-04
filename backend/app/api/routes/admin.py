from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.database.session import get_db
from app.models.user import User, UserRole
from app.schemas.admin import (
    AdminApplicationRead,
    AdminCandidateRead,
    AdminCompanyRead,
    AdminJobRead,
    AdminUserRead,
    ActiveUpdate,
    HiddenUpdate,
    RecruiterCreate,
    StaffMemberRead,
)
from app.schemas.screening import ScreeningQuestionRead, ScreeningQuestionsUpdate
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
    set_application_hidden,
    set_candidate_active,
    set_company_active,
)
from app.services.screening_service import list_admin_screening_questions, replace_admin_screening_questions
from app.services.staff_service import StaffCreationError, StaffEmailTakenError, create_staff_user, list_staff

router = APIRouter()

# Companies, users, candidates and applications: admin only.
admin_only = require_role(UserRole.admin)
# Jobs and screening are operated by the whole internal team.
staff = require_role(UserRole.admin, UserRole.recruiter)


@router.get("/users", response_model=list[AdminUserRead])
def get_users(db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    return list_admin_users(db, current_user)


@router.get("/candidates", response_model=list[AdminCandidateRead])
def get_candidates(db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    return list_admin_candidates(db, current_user)


@router.get("/companies", response_model=list[AdminCompanyRead])
def get_companies(db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    return list_admin_companies(db, current_user)


@router.get("/jobs", response_model=list[AdminJobRead])
def get_jobs(db: Session = Depends(get_db), current_user: User = Depends(staff)):
    return list_admin_jobs(db, current_user)


@router.get("/jobs/{job_id}/screening-questions", response_model=list[ScreeningQuestionRead])
def get_job_screening_questions(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(staff),
):
    return list_admin_screening_questions(db, current_user, job_id)


@router.put("/jobs/{job_id}/screening-questions", response_model=list[ScreeningQuestionRead])
def update_job_screening_questions(
    job_id: int,
    payload: ScreeningQuestionsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(staff),
):
    return replace_admin_screening_questions(db, current_user, job_id, payload.questions)


@router.get("/applications", response_model=list[AdminApplicationRead])
def get_applications(
    include_hidden: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    return list_admin_applications(db, current_user, include_hidden=include_hidden)


@router.put("/companies/{company_id}/active", response_model=AdminCompanyRead)
def set_company_active_endpoint(
    company_id: int,
    payload: ActiveUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    return set_company_active(db, current_user, company_id, payload.is_active)


@router.put("/candidates/{candidate_id}/active", response_model=AdminCandidateRead)
def set_candidate_active_endpoint(
    candidate_id: int,
    payload: ActiveUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    return set_candidate_active(db, current_user, candidate_id, payload.is_active)


@router.put("/applications/{application_id}/hidden", response_model=AdminApplicationRead)
def set_application_hidden_endpoint(
    application_id: int,
    payload: HiddenUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    return set_application_hidden(db, current_user, application_id, payload.is_hidden)


@router.put("/companies/{company_id}/approve", response_model=AdminCompanyRead)
def approve_company_endpoint(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    return approve_company(db, current_user, company_id)


@router.put("/companies/{company_id}/block", response_model=AdminCompanyRead)
def block_company_endpoint(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    return block_company(db, current_user, company_id)


@router.put("/jobs/{job_id}/approve", response_model=AdminJobRead)
def approve_job_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(staff),
):
    return approve_job(db, current_user, job_id)


@router.put("/jobs/{job_id}/hide", response_model=AdminJobRead)
def hide_job_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(staff),
):
    return hide_job(db, current_user, job_id)


@router.get("/recruiters", response_model=list[StaffMemberRead])
def get_recruiters(db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    return list_staff(db, roles=(UserRole.recruiter.value,))


@router.post("/recruiters", response_model=StaffMemberRead, status_code=status.HTTP_201_CREATED)
def create_recruiter_endpoint(
    payload: RecruiterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    try:
        return create_staff_user(db, payload.name, str(payload.email), payload.password, UserRole.recruiter)
    except StaffEmailTakenError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except StaffCreationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
