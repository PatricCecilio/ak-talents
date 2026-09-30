import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.schemas.screening import (
    AppIntelliScreeningContextRead,
    AppIntelliScreeningSubmitRequest,
    AppIntelliScreeningSubmitResponse,
)
from app.services.screening_service import (
    get_appintelli_screening_context,
    submit_appintelli_screening_answers,
)

router = APIRouter()


def require_appintelli_integration_secret(authorization: str | None = Header(default=None)) -> None:
    expected_secret = settings.APPINTELLI_INTEGRATION_SECRET
    if not expected_secret or not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    provided_secret = authorization.removeprefix("Bearer ").strip()
    if not secrets.compare_digest(provided_secret, expected_secret):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


@router.get(
    "/appintelli/applications/{reference}/screening",
    response_model=AppIntelliScreeningContextRead,
    dependencies=[Depends(require_appintelli_integration_secret)],
)
def get_appintelli_application_screening(reference: str, db: Session = Depends(get_db)):
    return get_appintelli_screening_context(db, reference)


@router.post(
    "/appintelli/applications/{reference}/screening/answers",
    response_model=AppIntelliScreeningSubmitResponse,
    dependencies=[Depends(require_appintelli_integration_secret)],
)
def submit_appintelli_application_screening_answers(
    reference: str,
    payload: AppIntelliScreeningSubmitRequest,
    db: Session = Depends(get_db),
):
    return submit_appintelli_screening_answers(db, reference, payload)
