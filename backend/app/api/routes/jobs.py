from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.job import JobCreate, JobRead
from app.schemas.match import CandidateMatchRead
from app.services.job_service import create_job, list_jobs
from app.services.match_service import get_job_matches

router = APIRouter()


@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
def create_job_endpoint(
    payload: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_job(db, current_user, payload)


@router.get("", response_model=list[JobRead])
def list_jobs_endpoint(db: Session = Depends(get_db)):
    return list_jobs(db)


@router.get("/{job_id}/matches", response_model=list[CandidateMatchRead])
def get_job_matches_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_job_matches(db, current_user, job_id)
