from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.application import ApplicationCreate, ApplicationRead
from app.services.application_service import create_application, list_applications

router = APIRouter()


@router.post("", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED)
def create_application_endpoint(
    payload: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_application(db, current_user, payload)


@router.get("", response_model=list[ApplicationRead])
def list_applications_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_applications(db, current_user)
