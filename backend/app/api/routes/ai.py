from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.ai import (
    CandidateProfileAIRequest,
    CandidateProfileAIResponse,
    CompanyJobAIRequest,
    CompanyJobAIResponse,
)
from app.services.ai_service import generate_candidate_profile, generate_company_job

router = APIRouter()


@router.post("/candidate-profile", response_model=CandidateProfileAIResponse)
def candidate_profile_ai(
    payload: CandidateProfileAIRequest,
    current_user: User = Depends(get_current_user),
):
    return generate_candidate_profile(current_user, payload)


@router.post("/company-job", response_model=CompanyJobAIResponse)
def company_job_ai(
    payload: CompanyJobAIRequest,
    current_user: User = Depends(get_current_user),
):
    return generate_company_job(current_user, payload)
