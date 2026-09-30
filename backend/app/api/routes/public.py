from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.screening import PublicScreeningRead, ScreeningSubmitRequest, ScreeningSubmitResponse
from app.services.screening_service import get_public_screening, submit_screening_answers_by_token

router = APIRouter()


@router.get("/applications/{token}/screening", response_model=PublicScreeningRead)
def get_public_application_screening(token: str, db: Session = Depends(get_db)):
    return get_public_screening(db, token)


@router.post("/applications/{token}/screening", response_model=ScreeningSubmitResponse)
def submit_public_application_screening(
    token: str,
    payload: ScreeningSubmitRequest,
    db: Session = Depends(get_db),
):
    return submit_screening_answers_by_token(db, token, payload)
