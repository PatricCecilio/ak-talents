"""What a client company sees of the pipeline: only finalists of its own jobs, minimal data.

Contact data (phone/e-mail) is released only after the company approves the finalist (LGPD data
minimisation). Everything else about candidates stays inside the AK Talent team.
"""

from collections import defaultdict

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.pipeline import Stage
from app.models.application import Application
from app.models.company import Company
from app.models.job import Job
from app.models.user import User
from app.schemas.company_pipeline import CompanyFinalist, CompanyFinalistsResponse, FinalistDecision
from app.services.pipeline_service import move_application

CONTACT_RELEASED_STAGES = (Stage.client_approved.value, Stage.hired.value)
NOT_AWAITING_DECISION = "Este candidato não está aguardando a sua decisão."


def _company_or_404(db: Session, current_user: User) -> Company:
    company = db.query(Company).filter(Company.user_id == current_user.id).first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil da empresa não encontrado.")
    return company


def _own_applications(db: Session, company: Company):
    return (
        db.query(Application)
        .join(Job, Application.job_id == Job.id)
        .filter(Job.company_id == company.id, Application.is_hidden.is_(False))
    )


def _to_finalist(application: Application) -> CompanyFinalist:
    candidate = application.candidate
    released = application.stage in CONTACT_RELEASED_STAGES
    return CompanyFinalist(
        application_id=application.id,
        job_id=application.job_id,
        job_title=application.job.title,
        candidate_name=candidate.full_name or (candidate.user.name if candidate.user else None) or "Candidato",
        city=candidate.city,
        experience_years=candidate.experience_years,
        finalist_summary=application.finalist_summary,
        status="approved" if released else "pending",
        updated_at=application.stage_updated_at,
        phone=candidate.phone if released else None,
        email=(candidate.email or (candidate.user.email if candidate.user else None)) if released else None,
    )


def list_company_finalists(db: Session, current_user: User) -> CompanyFinalistsResponse:
    company = _company_or_404(db, current_user)
    applications = (
        _own_applications(db, company)
        .filter(Application.stage.in_([Stage.finalist.value, *CONTACT_RELEASED_STAGES]))
        .order_by(Application.stage_updated_at.asc(), Application.id.asc())
        .all()
    )
    pending = [_to_finalist(item) for item in applications if item.stage == Stage.finalist.value]
    approved = [_to_finalist(item) for item in reversed(applications) if item.stage in CONTACT_RELEASED_STAGES]
    return CompanyFinalistsResponse(pending=pending, approved=approved)


def decide_finalist(db: Session, current_user: User, application_id: int, payload: FinalistDecision) -> CompanyFinalist:
    company = _company_or_404(db, current_user)
    application = _own_applications(db, company).filter(Application.id == application_id).first()
    if not application:
        # Same answer for "does not exist" and "belongs to another company".
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidatura não encontrada.")
    if application.stage != Stage.finalist.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=NOT_AWAITING_DECISION)

    if payload.decision == "approve":
        move_application(db, application, Stage.client_approved.value, current_user, note="Aprovado pela empresa para entrevista.")
    else:
        reason = (payload.reason or "").strip()
        note = f"Recusado pela empresa. Motivo: {reason}" if reason else "Recusado pela empresa."
        move_application(db, application, Stage.rejected.value, current_user, note=note)

    db.refresh(application)
    return _to_finalist(application)


def company_stage_counts(db: Session, job_ids: list[int]) -> dict[int, dict[str, int]]:
    """Counts only (no names) per job and stage, hidden applications excluded."""
    counts: dict[int, dict[str, int]] = defaultdict(lambda: {stage.value: 0 for stage in Stage})
    if job_ids:
        rows = (
            db.query(Application.job_id, Application.stage, func.count(Application.id))
            .filter(Application.job_id.in_(job_ids), Application.is_hidden.is_(False))
            .group_by(Application.job_id, Application.stage)
            .all()
        )
        for job_id, stage, total in rows:
            counts[job_id][stage] = total
    return counts

