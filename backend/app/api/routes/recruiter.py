from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.database.session import get_db
from app.models.user import User, UserRole
from app.schemas.admin import AdminJobRead, JobResponsibleUpdate, StaffMemberRead
from app.schemas.pipeline import (
    ApplicationDetail,
    JobPipelineResponse,
    NoteCreate,
    NoteRead,
    RecruiterJobsResponse,
    StageMoveRequest,
    StageMoveResponse,
    stage_label,
    stage_options,
)
from app.services.admin_service import job_to_admin_read
from app.services.pipeline_service import add_note, allowed_next_stages, get_application_or_404, move_application
from app.services.recruiter_read_service import get_application_detail, get_job_pipeline, list_recruiter_jobs
from app.schemas.candidate_pipeline import CompanyVisibilityUpdate
from app.services.recruiter_service import set_company_visibility, set_job_responsible
from app.services.staff_service import list_staff

router = APIRouter()

# The whole internal AK team (admin and recruiters) works in this area.
staff = require_role(UserRole.admin, UserRole.recruiter)


@router.get("/team", response_model=list[StaffMemberRead])
def get_team(db: Session = Depends(get_db), current_user: User = Depends(staff)):
    return list_staff(db, only_active=True)


@router.put("/jobs/{job_id}/responsible", response_model=AdminJobRead)
def update_job_responsible(
    job_id: int,
    payload: JobResponsibleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(staff),
):
    return job_to_admin_read(set_job_responsible(db, job_id, payload.recruiter_id))


@router.post("/applications/{application_id}/stage", response_model=StageMoveResponse)
def move_application_stage(
    application_id: int,
    payload: StageMoveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(staff),
):
    application = get_application_or_404(db, application_id)
    closed = move_application(
        db,
        application,
        payload.to_stage,
        current_user,
        note=payload.note,
        finalist_summary=payload.finalist_summary,
        close_other_active=payload.close_other_active,
        close_job=payload.close_job,
    )
    return StageMoveResponse(
        application_id=application.id,
        stage=application.stage,
        stage_label=stage_label(application.stage),
        stage_updated_at=application.stage_updated_at,
        allowed_next_stages=stage_options(allowed_next_stages(application, current_user.role)),
        closed_others_count=closed,
        job_closed=payload.close_job,
    )


@router.post("/applications/{application_id}/notes", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
def create_application_note(
    application_id: int,
    payload: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(staff),
):
    note = add_note(db, get_application_or_404(db, application_id), current_user, payload.body)
    return NoteRead(id=note.id, body=note.body, author_name=current_user.name, created_at=note.created_at)


@router.get("/jobs", response_model=RecruiterJobsResponse)
def get_recruiter_jobs(db: Session = Depends(get_db), current_user: User = Depends(staff)):
    return list_recruiter_jobs(db)


@router.get("/jobs/{job_id}/applications", response_model=JobPipelineResponse)
def get_recruiter_job_pipeline(
    job_id: int,
    stage: str | None = Query(default=None, max_length=30),
    db: Session = Depends(get_db),
    current_user: User = Depends(staff),
):
    return get_job_pipeline(db, job_id, current_user, stage)


@router.get("/applications/{application_id}", response_model=ApplicationDetail)
def get_recruiter_application(application_id: int, db: Session = Depends(get_db), current_user: User = Depends(staff)):
    return get_application_detail(db, application_id, current_user)


@router.put("/jobs/{job_id}/candidate-visibility", response_model=AdminJobRead)
def update_job_company_visibility(
    job_id: int,
    payload: CompanyVisibilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(staff),
):
    """Show (or hide) the client company name to candidates in "Minhas candidaturas". Off by default."""
    return job_to_admin_read(set_company_visibility(db, job_id, payload.show_company_to_candidates))
