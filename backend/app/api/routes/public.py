from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.rate_limit import PUBLIC_SCREENING_LIMIT, limiter
from app.database.session import get_db
from app.schemas.screening import PublicScreeningRead, ScreeningSubmitRequest, ScreeningSubmitResponse
from app.services.screening_service import get_public_screening, submit_screening_answers_by_token

router = APIRouter()


@router.get("/applications/{token}/screening", response_model=PublicScreeningRead)
@limiter.limit(PUBLIC_SCREENING_LIMIT)
def get_public_application_screening(request: Request, token: str, db: Session = Depends(get_db)):
    return get_public_screening(db, token)


@router.post("/applications/{token}/screening", response_model=ScreeningSubmitResponse)
@limiter.limit(PUBLIC_SCREENING_LIMIT)
def submit_public_application_screening(
    request: Request,
    token: str,
    payload: ScreeningSubmitRequest,
    db: Session = Depends(get_db),
):
    return submit_screening_answers_by_token(db, token, payload)
