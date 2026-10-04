"""Read models for the recruiter area (/recrutador). Callers must already be AK staff."""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.pipeline import ACTIVE_STAGES, Stage
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.screening import ScreeningAnswer, ScreeningQuestion
from app.models.user import User
from app.schemas.pipeline import (
    ApplicationCard,
    ApplicationDetail,
    CandidateContact,
    JobPipelineResponse,
    NoteRead,
    RecruiterJobsResponse,
    RecruiterJobSummary,
    ScreeningAnswerView,
    ScreeningView,
    StageHistoryRead,
    stage_label,
    stage_options,
)
from app.services.pipeline_service import allowed_next_stages, get_application_or_404

ACTIVE_STAGE_VALUES = [stage.value for stage in ACTIVE_STAGES]


def _alert_days() -> int:
    return max(settings.FINALIST_ALERT_DAYS, 0)


def _as_utc(value: datetime) -> datetime:
    # SQLite gives naive datetimes back; everything is stored in UTC.
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _waiting_too_long(application: Application, now: datetime) -> bool:
    if application.stage != Stage.finalist.value:
        return False
    return now - _as_utc(application.stage_updated_at) > timedelta(days=_alert_days())


def _candidate_name(candidate: Candidate) -> str:
    return candidate.full_name or (candidate.user.name if candidate.user else None) or "Candidato"


def _visible_applications(db: Session):
    return db.query(Application).filter(Application.is_hidden.is_(False))


def _summaries(db: Session, jobs: list[Job]) -> list[RecruiterJobSummary]:
    job_ids = [job.id for job in jobs]
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

    now = datetime.now(timezone.utc)
    waiting: dict[int, int] = defaultdict(int)
    if job_ids:
        finalists = _visible_applications(db).filter(Application.job_id.in_(job_ids), Application.stage == Stage.finalist.value).all()
        for application in finalists:
            if _waiting_too_long(application, now):
                waiting[application.job_id] += 1

    return [
        RecruiterJobSummary(
            id=job.id,
            title=job.title,
            company_name=job.company.company_name,
            location=job.location,
            status=job.status,
            is_active=job.is_active,
            recruiter_id=job.recruiter_id,
            recruiter_name=job.recruiter.name if job.recruiter else None,
            stage_counts=counts[job.id],
            active_count=sum(counts[job.id][stage] for stage in ACTIVE_STAGE_VALUES),
            finalists_waiting=waiting[job.id],
        )
        for job in jobs
    ]


def list_recruiter_jobs(db: Session) -> RecruiterJobsResponse:
    jobs = (
        db.query(Job)
        .join(Company, Job.company_id == Company.id)
        .join(User, Company.user_id == User.id)
        .filter(User.is_active.is_(True))  # deactivated (test) companies drop out of the AK lists
        .order_by(Job.created_at.desc(), Job.id.desc())
        .all()
    )
    return RecruiterJobsResponse(finalist_alert_days=_alert_days(), jobs=_summaries(db, jobs))


def get_job_pipeline(db: Session, job_id: int, actor: User, stage: str | None = None) -> JobPipelineResponse:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga não encontrada.")

    query = _visible_applications(db).filter(Application.job_id == job.id)
    if stage:
        query = query.filter(Application.stage == stage)
    applications = query.order_by(Application.stage_updated_at.desc(), Application.id.desc()).all()

    now = datetime.now(timezone.utc)
    return JobPipelineResponse(
        finalist_alert_days=_alert_days(),
        job=_summaries(db, [job])[0],
        applications=[
            ApplicationCard(
                id=application.id,
                candidate_name=_candidate_name(application.candidate),
                city=application.candidate.city,
                neighborhood=application.candidate.neighborhood,
                stage=application.stage,
                stage_label=stage_label(application.stage),
                stage_updated_at=application.stage_updated_at,
                screening_status=application.screening_status,
                screening_score=application.screening_score,
                created_at=application.created_at,
                waiting_client_too_long=_waiting_too_long(application, now),
                allowed_next_stages=stage_options(allowed_next_stages(application, actor.role)),
            )
            for application in applications
        ],
    )


def _format_answer(question: ScreeningQuestion, answer: ScreeningAnswer) -> str:
    if question.question_type == "YES_NO":
        return "Sim" if answer.value_bool else "Não" if answer.value_bool is not None else ""
    if question.question_type == "SINGLE_SELECT":
        labels = {option.get("value"): option.get("label") for option in (question.options or [])}
        return labels.get(answer.value_select) or answer.value_select or ""
    return answer.value_text or ""


def get_application_detail(db: Session, application_id: int, actor: User) -> ApplicationDetail:
    application = get_application_or_404(db, application_id)
    candidate = application.candidate

    answers = (
        db.query(ScreeningAnswer, ScreeningQuestion)
        .join(ScreeningQuestion, ScreeningAnswer.question_id == ScreeningQuestion.id)
        .filter(ScreeningAnswer.application_id == application.id)
        .order_by(ScreeningQuestion.sort_order, ScreeningQuestion.id)
        .all()
    )
    other_active = (
        _visible_applications(db)
        .filter(
            Application.job_id == application.job_id,
            Application.id != application.id,
            Application.stage.in_(ACTIVE_STAGE_VALUES),
        )
        .count()
    )

    return ApplicationDetail(
        id=application.id,
        job_id=application.job_id,
        job_title=application.job.title,
        company_name=application.job.company.company_name,
        created_at=application.created_at,
        stage=application.stage,
        stage_label=stage_label(application.stage),
        stage_updated_at=application.stage_updated_at,
        finalist_summary=application.finalist_summary,
        cover_letter=application.cover_letter,
        is_hidden=application.is_hidden,
        candidate=CandidateContact(
            name=_candidate_name(candidate),
            email=candidate.email or (candidate.user.email if candidate.user else None),
            phone=candidate.phone,
            city=candidate.city,
            neighborhood=candidate.neighborhood,
            desired_role=candidate.desired_role,
            experience_years=candidate.experience_years,
            skills=candidate.skills,
            linkedin_url=candidate.linkedin_url,
            portfolio_url=candidate.portfolio_url,
            has_account=candidate.user_id is not None,
        ),
        screening=ScreeningView(
            status=application.screening_status,
            score=application.screening_score,
            summary=application.screening_summary,
            completed_at=application.screening_completed_at,
            answers=[ScreeningAnswerView(question=question.label, answer=_format_answer(question, answer)) for answer, question in answers],
        ),
        history=[
            StageHistoryRead(
                from_stage=entry.from_stage,
                from_stage_label=stage_label(entry.from_stage) if entry.from_stage else None,
                to_stage=entry.to_stage,
                to_stage_label=stage_label(entry.to_stage),
                changed_by_name=entry.changed_by.name if entry.changed_by else None,
                changed_by_role=entry.changed_by_role,
                note=entry.note,
                created_at=entry.created_at,
            )
            for entry in application.stage_history
        ],
        notes=[
            NoteRead(id=note.id, body=note.body, author_name=note.author.name if note.author else None, created_at=note.created_at)
            for note in reversed(application.notes)
        ],
        allowed_next_stages=stage_options(allowed_next_stages(application, actor.role)),
        other_active_count=other_active,
    )
