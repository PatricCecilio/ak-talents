import re

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.user import User, UserRole
from app.schemas.match import CandidateMatchRead


def _normalize(value: str | None) -> str:
    return (value or "").strip().lower()


def _extract_terms(value: str | None) -> set[str]:
    normalized = _normalize(value)

    if not normalized:
        return set()

    rough_terms = re.split(r"[,;\n|/]+", normalized)
    terms = {term.strip() for term in rough_terms if len(term.strip()) >= 2}

    if len(terms) <= 1:
        terms.update(re.findall(r"[a-zA-ZÀ-ÿ0-9+#.]{3,}", normalized))

    return terms


def _extract_required_years(value: str | None) -> float | None:
    match = re.search(r"(\d+(?:[,.]\d+)?)\s*\+?\s*(?:anos|ano|years|year)", _normalize(value))

    if not match:
        return None

    return float(match.group(1).replace(",", "."))


def _work_mode_matches(candidate_work_mode: str | None, job_work_mode: str | None) -> bool:
    candidate_mode = _normalize(candidate_work_mode)
    job_mode = _normalize(job_work_mode)

    if not candidate_mode or not job_mode:
        return False

    if candidate_mode == job_mode:
        return True

    return candidate_mode == "remote" and job_mode == "hybrid"


def _salary_matches(candidate_salary: float | None, job: Job) -> bool:
    if candidate_salary is None:
        return False

    if job.salary_max is not None and candidate_salary <= job.salary_max:
        return True

    if job.salary_min is not None and job.salary_max is None and candidate_salary >= job.salary_min:
        return True

    return job.salary_min is None and job.salary_max is None


def _candidate_score(candidate: Candidate, job: Job) -> CandidateMatchRead:
    score = 0
    reasons: list[str] = []
    candidate_terms = _extract_terms(candidate.skills)
    job_terms = _extract_terms(job.requirements or job.description or job.title)
    common_skills = sorted(candidate_terms.intersection(job_terms))

    if common_skills:
        skill_score = min(len(common_skills) * 10, 40)
        score += skill_score
        reasons.append(f"Possui {len(common_skills)} habilidades em comum")

    if _normalize(candidate.city) and _normalize(candidate.city) == _normalize(job.location):
        score += 15
        reasons.append("Cidade/localizacao compatível")
    elif _normalize(job.work_mode) == "remote":
        score += 8
        reasons.append("Localizacao flexivel por vaga remota")

    if _work_mode_matches(candidate.work_mode, job.work_mode):
        score += 20
        reasons.append(f"Aceita trabalho {job.work_mode}")

    if _salary_matches(candidate.salary_expectation, job):
        score += 15
        reasons.append("Pretensao salarial compatível")

    required_years = _extract_required_years(job.requirements)
    if candidate.experience_years is not None:
        if required_years is None:
            score += 10
            reasons.append("Experiencia profissional informada")
        elif candidate.experience_years >= required_years:
            score += 10
            reasons.append("Experiencia compatível com a vaga")

    if not reasons:
        reasons.append("Dados insuficientes para identificar alta compatibilidade")

    return CandidateMatchRead(
        candidate_id=candidate.id,
        name=candidate.user.name,
        score=min(score, 100),
        reasons=reasons,
    )


def get_job_matches(db: Session, current_user: User, job_id: int) -> list[CandidateMatchRead]:
    if current_user.role != UserRole.company.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only companies can view job matches")

    company = db.query(Company).filter(Company.user_id == current_user.id).first()

    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company profile not found")

    job = db.query(Job).filter(Job.id == job_id, Job.company_id == company.id).first()

    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    candidates = db.query(Candidate).join(Candidate.user).all()
    matches = [_candidate_score(candidate, job) for candidate in candidates]
    return sorted(matches, key=lambda match: match.score, reverse=True)
