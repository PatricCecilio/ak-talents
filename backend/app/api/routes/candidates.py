from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
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
