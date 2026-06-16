from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.company import CompanyProfileRead, CompanyProfileUpdate
from app.services.profile_service import get_company_profile, update_company_profile

router = APIRouter()


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
