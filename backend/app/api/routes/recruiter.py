from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.database.session import get_db
from app.models.user import User, UserRole
from app.schemas.admin import AdminJobRead, JobResponsibleUpdate, StaffMemberRead
from app.schemas.pipeline import NoteCreate, NoteRead, StageMoveRequest, StageMoveResponse, stage_label, stage_options
from app.services.admin_service import job_to_admin_read
from app.services.pipeline_service import add_note, allowed_next_stages, get_application_or_404, move_application
from app.services.recruiter_service import set_job_responsible
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
    )
    return StageMoveResponse(
        application_id=application.id,
        stage=application.stage,
        stage_label=stage_label(application.stage),
        stage_updated_at=application.stage_updated_at,
        allowed_next_stages=stage_options(allowed_next_stages(application, current_user.role)),
        closed_others_count=closed,
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
