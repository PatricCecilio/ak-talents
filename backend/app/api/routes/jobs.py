from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.application import PublicApplicationCreate, PublicApplicationRead
from app.schemas.job import JobCreate, JobRead, PublicJobRead
from app.schemas.match import CandidateMatchRead
from app.services.application_service import create_public_application
from app.services.job_service import create_job, get_public_job_by_slug, list_jobs, public_job_to_read
from app.services.match_service import get_job_matches

router = APIRouter()


@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
def create_job_endpoint(
    payload: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_job(db, current_user, payload)


@router.get("", response_model=list[PublicJobRead])
def list_jobs_endpoint(db: Session = Depends(get_db)):
    return [public_job_to_read(db, job) for job in list_jobs(db)]


@router.get("/{job_id}/matches", response_model=list[CandidateMatchRead])
def get_job_matches_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_job_matches(db, current_user, job_id)


@router.post("/{slug}/applications", response_model=PublicApplicationRead, status_code=status.HTTP_201_CREATED)
def create_public_application_endpoint(
    slug: str,
    payload: PublicApplicationCreate,
    db: Session = Depends(get_db),
):
    return create_public_application(db, slug, payload)


@router.get("/{slug}", response_model=PublicJobRead)
def get_public_job_endpoint(slug: str, db: Session = Depends(get_db)):
    return public_job_to_read(db, get_public_job_by_slug(db, slug))
