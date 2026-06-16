from fastapi import HTTPException, status
from openai import OpenAI, OpenAIError

from app.core.config import settings
from app.models.user import User, UserRole
from app.schemas.ai import (
    CandidateProfileAIRequest,
    CandidateProfileAIResponse,
    CompanyJobAIRequest,
    CompanyJobAIResponse,
)


def _get_client() -> OpenAI:
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENAI_API_KEY is not configured",
        )

    return OpenAI(api_key=settings.OPENAI_API_KEY)


def generate_candidate_profile(
    current_user: User,
    payload: CandidateProfileAIRequest,
) -> CandidateProfileAIResponse:
    if current_user.role != UserRole.candidate.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only candidates can use Career AI")

    client = _get_client()

    try:
        completion = client.chat.completions.parse(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Voce e o Career AI da AK Talent. Ajude candidatos brasileiros a organizar "
                        "um perfil profissional claro, honesto e competitivo. Responda em portugues do Brasil."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Cargo desejado: {payload.desired_role}\n"
                        f"Experiencia: {payload.experience}\n"
                        f"Habilidades: {payload.skills}\n"
                        f"Cidade: {payload.city}\n"
                        f"Modelo de trabalho: {payload.work_mode}\n"
                        f"Pretensao salarial: {payload.salary_expectation}"
                    ),
                },
            ],
            response_format=CandidateProfileAIResponse,
        )
    except OpenAIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenAI request failed: {exc}",
        ) from exc

    parsed = completion.choices[0].message.parsed

    if parsed is None:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="OpenAI returned an empty response")

    return parsed


def generate_company_job(
    current_user: User,
    payload: CompanyJobAIRequest,
) -> CompanyJobAIResponse:
    if current_user.role != UserRole.company.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only companies can use Recruiter AI")

    client = _get_client()

    try:
        completion = client.chat.completions.parse(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Voce e o Recruiter AI da AK Talent. Ajude empresas brasileiras a criar vagas "
                        "mais claras, inclusivas e objetivas. Responda em portugues do Brasil."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Cargo: {payload.role}\n"
                        f"Atividades: {payload.activities}\n"
                        f"Requisitos: {payload.requirements}\n"
                        f"Salario: {payload.salary}\n"
                        f"Cidade: {payload.city}\n"
                        f"Modelo de trabalho: {payload.work_mode}"
                    ),
                },
            ],
            response_format=CompanyJobAIResponse,
        )
    except OpenAIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenAI request failed: {exc}",
        ) from exc

    parsed = completion.choices[0].message.parsed

    if parsed is None:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="OpenAI returned an empty response")

    return parsed
