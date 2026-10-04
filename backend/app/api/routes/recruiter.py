from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.database.session import get_db
from app.models.user import User, UserRole
from app.schemas.admin import AdminJobRead, JobResponsibleUpdate, StaffMemberRead
from app.services.admin_service import job_to_admin_read
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
