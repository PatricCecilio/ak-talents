from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.models.company import Company
from app.models.user import User, UserRole
from app.schemas.candidate import CandidateProfileRead, CandidateProfileUpdate
from app.schemas.company import CompanyProfileRead, CompanyProfileUpdate


def _require_candidate(current_user: User) -> None:
    if current_user.role != UserRole.candidate.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only candidates can access this profile")


def _require_company(current_user: User) -> None:
    if current_user.role != UserRole.company.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only companies can access this profile")


def _candidate_to_read(candidate: Candidate) -> CandidateProfileRead:
    return CandidateProfileRead(
        id=candidate.id,
        user_id=candidate.user_id,
        full_name=candidate.full_name or candidate.user.name,
        phone=candidate.phone,
        city=candidate.city,
        state=candidate.state,
        desired_role=candidate.desired_role,
        professional_summary=candidate.bio,
        skills=candidate.skills,
        experience_years=candidate.experience_years,
        salary_expectation=candidate.salary_expectation,
        work_mode=candidate.work_mode,
        linkedin_url=candidate.linkedin_url,
        portfolio_url=candidate.portfolio_url,
        created_at=candidate.created_at,
    )


def _company_to_read(company: Company) -> CompanyProfileRead:
    return CompanyProfileRead(
        id=company.id,
        user_id=company.user_id,
        company_name=company.company_name,
        responsible_name=company.responsible_name or company.user.name,
        phone=company.phone,
        city=company.city,
        state=company.state,
        industry=company.industry,
        company_size=company.company_size,
        status=company.status,
        description=company.description,
        website_url=company.website,
        created_at=company.created_at,
    )


def get_candidate_profile(db: Session, current_user: User) -> CandidateProfileRead:
    _require_candidate(current_user)
    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.id).first()

    if not candidate:
        candidate = Candidate(user_id=current_user.id, full_name=current_user.name)
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

    return _candidate_to_read(candidate)


def update_candidate_profile(
    db: Session,
    current_user: User,
    payload: CandidateProfileUpdate,
) -> CandidateProfileRead:
    _require_candidate(current_user)
    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.id).first()

    if not candidate:
        candidate = Candidate(user_id=current_user.id)
        db.add(candidate)

    update_data = payload.model_dump(exclude_unset=True)
    professional_summary = update_data.pop("professional_summary", None)

    for field, value in update_data.items():
        setattr(candidate, field, value)

    if professional_summary is not None:
        candidate.bio = professional_summary

    if candidate.full_name:
        current_user.name = candidate.full_name

    db.commit()
    db.refresh(candidate)
    return _candidate_to_read(candidate)


def get_company_profile(db: Session, current_user: User) -> CompanyProfileRead:
    _require_company(current_user)
    company = db.query(Company).filter(Company.user_id == current_user.id).first()

    if not company:
        company = Company(user_id=current_user.id, company_name=current_user.name)
        db.add(company)
        db.commit()
        db.refresh(company)

    return _company_to_read(company)


def update_company_profile(
    db: Session,
    current_user: User,
    payload: CompanyProfileUpdate,
) -> CompanyProfileRead:
    _require_company(current_user)
    company = db.query(Company).filter(Company.user_id == current_user.id).first()

    if not company:
        company = Company(user_id=current_user.id, company_name=current_user.name)
        db.add(company)

    update_data = payload.model_dump(exclude_unset=True)
    website_url = update_data.pop("website_url", None)

    for field, value in update_data.items():
        if value is not None or field != "company_name":
            setattr(company, field, value)

    if website_url is not None:
        company.website = website_url

    current_user.name = company.responsible_name or current_user.name

    db.commit()
    db.refresh(company)
    return _company_to_read(company)
