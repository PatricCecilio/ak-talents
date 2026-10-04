from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.database.session import get_db
from app.models.user import User, UserRole
from app.schemas.candidate_pipeline import CandidateApplicationsResponse
from app.services.candidate_pipeline_service import list_my_applications
from app.schemas.candidate import CandidateProfileRead, CandidateProfileUpdate
from app.services.profile_service import get_candidate_profile, update_candidate_profile

router = APIRouter()


@router.get("/me", response_model=CandidateProfileRead)
def get_my_candidate_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_candidate_profile(db, current_user)


@router.put("/me", response_model=CandidateProfileRead)
def update_my_candidate_profile(
    payload: CandidateProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_candidate_profile(db, current_user, payload)


@router.get("/me/applications", response_model=CandidateApplicationsResponse)
def list_my_candidate_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.candidate)),
):
    return list_my_applications(db, current_user)
