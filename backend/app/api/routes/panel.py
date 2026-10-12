"""New panel (/painel) for the AK team. Admin and recruiters share most screens; the admin-only parts
(team management, LGPD erasure, assigning the responsible recruiter) are enforced here, not only in the screen."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.database.session import get_db
from app.models.company import Company
from app.models.user import User, UserRole
from app.schemas.admin import AdminCompanyRead, AdminJobRead, ActiveUpdate, JobResponsibleUpdate
from app.schemas.panel import (
    CandidateDetail,
    CandidatesListResponse,
    CandidateWrite,
    ErasureRequest,
    ErasureResponse,
    JobsListResponse,
    ManualCandidateCreate,
    OverviewResponse,
    PanelJobDetail,
    ReferRequest,
    ReferResponse,
    SearchResponse,
    TeamMemberDetail,
    TeamMemberRow,
    TeamMemberUpdate,
)
from app.services.admin_service import company_to_admin_read, job_to_admin_read
from app.services.panel_people_service import (
    candidate_detail,
    create_manual_candidate,
    erase_candidate_data,
    list_candidates,
    list_team,
    refer_to_job,
    set_team_member_active,
    team_member_detail,
    update_candidate,
    update_team_member,
)
from app.services.panel_service import job_detail, list_jobs, overview, search
from app.services.recruiter_service import set_job_responsible

router = APIRouter()

staff = require_role(UserRole.admin, UserRole.recruiter)
admin_only = require_role(UserRole.admin)


@router.get("/overview", response_model=OverviewResponse)
def get_overview(db: Session = Depends(get_db), current_user: User = Depends(staff)):
    """Admin: everything. Recruiter: only the jobs they are responsible for."""
    return overview(db, current_user)


@router.get("/jobs", response_model=JobsListResponse)
def get_jobs(
    status_filter: str | None = Query(default=None, alias="status", max_length=20),
    company_id: int | None = Query(default=None),
    recruiter_id: int | None = Query(default=None),
    no_recruiter: bool = Query(default=False),
    mine: bool = Query(default=False),
    include_archived: bool = Query(default=False),
    focus: str | None = Query(default=None, max_length=20),
    page: int = Query(default=1, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(staff),
):
    return list_jobs(
        db,
        current_user,
        status=status_filter,
        company_id=company_id,
        recruiter_id=recruiter_id,
        no_recruiter=no_recruiter,
        mine=mine,
        include_archived=include_archived,
        focus=focus,
        page=page,
    )


@router.get("/jobs/{job_id}", response_model=PanelJobDetail)
def get_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(staff)):
    """Header and "Detalhes da vaga" (a recruiter: only their own jobs; editing stays admin-only in /admin/jobs/{id})."""
    return job_detail(db, current_user, job_id)


@router.put("/jobs/{job_id}/responsible", response_model=AdminJobRead)
def assign_responsible(
    job_id: int,
    payload: JobResponsibleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    """Only the admin assigns (or changes) the recruiter responsible for a job."""
    return job_to_admin_read(set_job_responsible(db, job_id, payload.recruiter_id))


@router.get("/companies", response_model=list[AdminCompanyRead])
def get_companies(db: Session = Depends(get_db), current_user: User = Depends(staff)):
    """Read-only for recruiters (they need to know who the client is); creating and editing stay in /admin."""
    companies = db.query(Company).order_by(Company.is_active.desc(), Company.company_name).all()
    return [company_to_admin_read(company) for company in companies]


@router.get("/search", response_model=SearchResponse)
def get_search(q: str = Query(default="", max_length=100), db: Session = Depends(get_db), current_user: User = Depends(staff)):
    return search(db, current_user, q)


# --- candidates -------------------------------------------------------------------------------------------------------


@router.get("/candidates", response_model=CandidatesListResponse)
def get_candidates(
    stage: str | None = Query(default=None, max_length=30),
    job_id: int | None = Query(default=None),
    city: str | None = Query(default=None, max_length=180),
    q: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(staff),
):
    return list_candidates(db, current_user, stage=stage, job_id=job_id, city=city, text=q, page=page)


@router.post("/candidates", response_model=CandidateDetail, status_code=status.HTTP_201_CREATED)
def post_candidate(payload: ManualCandidateCreate, db: Session = Depends(get_db), current_user: User = Depends(staff)):
    """Manual registration by AK: the candidate's authorization is required and recorded (date and author)."""
    return create_manual_candidate(db, current_user, payload)


@router.get("/candidates/{candidate_id}", response_model=CandidateDetail)
def get_candidate(candidate_id: int, db: Session = Depends(get_db), current_user: User = Depends(staff)):
    return candidate_detail(db, current_user, candidate_id)


@router.put("/candidates/{candidate_id}", response_model=CandidateDetail)
def put_candidate(candidate_id: int, payload: CandidateWrite, db: Session = Depends(get_db), current_user: User = Depends(staff)):
    return update_candidate(db, current_user, candidate_id, payload)


@router.post("/candidates/{candidate_id}/erase", response_model=ErasureResponse)
def erase_candidate(
    candidate_id: int, payload: ErasureRequest, db: Session = Depends(get_db), current_user: User = Depends(admin_only)
):
    """LGPD: erases personal data (cannot be undone). Only the admin; logged with who and when."""
    return erase_candidate_data(db, current_user, candidate_id, payload.confirmation)


@router.post("/applications/{application_id}/refer", response_model=ReferResponse, status_code=status.HTTP_201_CREATED)
def refer_application(
    application_id: int, payload: ReferRequest, db: Session = Depends(get_db), current_user: User = Depends(staff)
):
    """"Indicar para outra vaga": new application in "Nova"; the current one does not change."""
    return refer_to_job(db, current_user, application_id, payload.job_id)


# --- team (admin only) --------------------------------------------------------------------------------------------------


@router.get("/team", response_model=list[TeamMemberRow])
def get_team(db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    return list_team(db)


@router.get("/team/{user_id}", response_model=TeamMemberDetail)
def get_team_member(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    return team_member_detail(db, user_id)


@router.put("/team/{user_id}", response_model=TeamMemberRow)
def put_team_member(user_id: int, payload: TeamMemberUpdate, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    return update_team_member(db, user_id, payload)


@router.put("/team/{user_id}/active", response_model=TeamMemberRow)
def put_team_member_active(
    user_id: int, payload: ActiveUpdate, db: Session = Depends(get_db), current_user: User = Depends(admin_only)
):
    return set_team_member_active(db, current_user, user_id, payload.is_active)
