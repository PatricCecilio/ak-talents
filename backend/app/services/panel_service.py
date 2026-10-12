"""Panel (/painel) read models: overview, jobs list with counts, global search.

Callers are AK staff (routes enforce it). A recruiter only sees the jobs they are responsible for (app.services.access):
overview, jobs list, job page and search alike. The admin sees everything.
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.pipeline import STAGE_LABELS, Stage
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.pipeline import ApplicationStageHistory
from app.models.user import User
from app.schemas.panel import (
    ActivityItem,
    JobsListResponse,
    JobsSummary,
    OverviewCards,
    OverviewResponse,
    PanelJobDetail,
    PanelJobRow,
    SearchHit,
    SearchResponse,
    StageCount,
)
from app.services.access import has_application_in, is_restricted, job_for, scope_jobs, visible_job_ids
from app.services.identity_service import normalize_phone

PAGE_SIZE = 10
# Brazil has no daylight saving time since 2019: months and "today" follow UTC-3.
BRT = timezone(timedelta(hours=-3))
# Board columns, in order (rejected/withdrawn are the exits, hidden by default).
BOARD_STAGES = (Stage.new, Stage.screening, Stage.ak_interview, Stage.finalist, Stage.client_approved, Stage.hired)
STATUS_ORDER = {"approved": 0, "draft": 1, "closed": 2, "archived": 3}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime | None) -> datetime | None:
    # SQLite returns naive datetimes; everything is stored in UTC.
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def month_start_utc(now: datetime | None = None) -> datetime:
    local = (now or now_utc()).astimezone(BRT)
    return local.replace(day=1, hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)


def alert_days() -> int:
    return max(settings.FINALIST_ALERT_DAYS, 0)


def _visible_applications(db: Session):
    """Applications that count: not hidden, of jobs that are not archived, of active companies."""
    return (
        db.query(Application)
        .join(Job, Application.job_id == Job.id)
        .join(Company, Job.company_id == Company.id)
        .filter(Application.is_hidden.is_(False), Job.status != "archived", Company.is_active.is_(True))
    )


def job_counts(db: Session, job_ids: list[int]) -> dict[int, dict[str, int]]:
    """Visible applications per job and stage (every stage present)."""
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


def _waiting_counts(db: Session, job_ids: list[int], now: datetime) -> dict[int, int]:
    waiting: dict[int, int] = defaultdict(int)
    if not job_ids:
        return waiting
    limit = now - timedelta(days=alert_days())
    for job_id, updated in (
        db.query(Application.job_id, Application.stage_updated_at)
        .filter(Application.job_id.in_(job_ids), Application.is_hidden.is_(False), Application.stage == Stage.finalist.value)
        .all()
    ):
        if as_utc(updated) < limit:
            waiting[job_id] += 1
    return waiting


def job_rows(db: Session, jobs: list[Job]) -> list[PanelJobRow]:
    ids = [job.id for job in jobs]
    counts = job_counts(db, ids)
    waiting = _waiting_counts(db, ids, now_utc())
    return [
        PanelJobRow(
            id=job.id,
            title=job.title,
            slug=job.slug,
            company_id=job.company_id,
            company_name=job.company.company_name,
            location=job.location,
            recruiter_id=job.recruiter_id,
            recruiter_name=job.recruiter.name if job.recruiter else None,
            status=job.status,
            openings=job.openings,
            applications=sum(counts[job.id].values()),
            to_triage=counts[job.id][Stage.new.value],
            with_client=counts[job.id][Stage.finalist.value],
            waiting_client_too_long=waiting[job.id],
            published_at=job.published_at,
            created_at=job.created_at,
            company_is_active=job.company.is_active,
        )
        for job in jobs
    ]


def _scoped_jobs(db: Session, actor: User):
    return scope_jobs(db.query(Job).join(Company, Job.company_id == Company.id), actor)


# --- overview ---------------------------------------------------------------------------------------------------------


def _activity(db: Session, job_ids: list[int] | None, limit: int = 8) -> list[ActivityItem]:
    items: list[ActivityItem] = []

    def scoped(query, column):
        return query.filter(column.in_(job_ids)) if job_ids is not None else query

    new_apps = (
        scoped(_visible_applications(db), Application.job_id).order_by(Application.created_at.desc()).limit(limit).all()
    )
    for application in new_apps:
        items.append(
            ActivityItem(
                kind="new_application",
                title="Nova candidatura",
                detail=f"{_candidate_name(application.candidate)} · {application.job.title}",
                at=as_utc(application.created_at),
                job_id=application.job_id,
                application_id=application.id,
            )
        )

    history = (
        scoped(
            db.query(ApplicationStageHistory)
            .join(Application, ApplicationStageHistory.application_id == Application.id)
            .filter(
                Application.is_hidden.is_(False),
                or_(
                    ApplicationStageHistory.to_stage.in_([Stage.finalist.value, Stage.hired.value]),
                    ApplicationStageHistory.note.like("Resposta do cliente:%"),
                ),
            ),
            Application.job_id,
        )
        .order_by(ApplicationStageHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    for entry in history:
        application = entry.application
        if entry.to_stage == Stage.finalist.value:
            kind, title = "sent_to_client", "Enviado ao cliente"
        elif entry.to_stage == Stage.hired.value:
            kind, title = "hired", "Contratado"
        elif (entry.note or "").startswith("Resposta do cliente: aprovou"):
            kind, title = "client_approved", "Cliente aprovou"
        else:
            kind, title = "client_rejected", "Cliente recusou"
        items.append(
            ActivityItem(
                kind=kind,
                title=title,
                detail=f"{_candidate_name(application.candidate)} · {application.job.title}",
                at=as_utc(entry.created_at),
                job_id=application.job_id,
                application_id=application.id,
            )
        )

    published = scoped(db.query(Job).filter(Job.published_at.isnot(None), Job.status != "archived"), Job.id)
    for job in published.order_by(Job.published_at.desc()).limit(limit).all():
        items.append(
            ActivityItem(
                kind="job_published",
                title="Vaga publicada",
                detail=f"{job.title} · {job.company.company_name}",
                at=as_utc(job.published_at),
                job_id=job.id,
            )
        )

    items.sort(key=lambda item: item.at, reverse=True)
    return items[:limit]


def _candidate_name(candidate: Candidate) -> str:
    return candidate.full_name or (candidate.user.name if candidate.user else None) or "Candidato"


def overview(db: Session, actor: User) -> OverviewResponse:
    now = now_utc()
    mine = is_restricted(actor)
    scope_ids = [job_id for (job_id,) in _scoped_jobs(db, actor).with_entities(Job.id).all()] if mine else None

    apps = _visible_applications(db)
    if scope_ids is not None:
        apps = apps.filter(Application.job_id.in_(scope_ids))
    stage_rows = dict(apps.with_entities(Application.stage, func.count(Application.id)).group_by(Application.stage).all())

    new_query = apps.filter(Application.stage == Stage.new.value)
    to_triage_24h = sum(1 for (created,) in new_query.with_entities(Application.created_at).all() if as_utc(created) > now - timedelta(hours=24))
    finalists = apps.filter(Application.stage == Stage.finalist.value).with_entities(Application.stage_updated_at).all()
    waiting_long = sum(1 for (updated,) in finalists if as_utc(updated) < now - timedelta(days=alert_days()))

    hires = (
        db.query(func.count(ApplicationStageHistory.id))
        .join(Application, ApplicationStageHistory.application_id == Application.id)
        .filter(ApplicationStageHistory.to_stage == Stage.hired.value, ApplicationStageHistory.created_at >= month_start_utc(now))
    )
    if scope_ids is not None:
        hires = hires.filter(Application.job_id.in_(scope_ids))

    jobs = _scoped_jobs(db, actor).filter(Company.is_active.is_(True))
    status_rows = dict(jobs.with_entities(Job.status, func.count(Job.id)).group_by(Job.status).all())
    published_jobs = jobs.filter(Job.status == "approved").order_by(Job.published_at.desc(), Job.id.desc()).all()
    published_rows = job_rows(db, published_jobs)

    return OverviewResponse(
        scope="mine" if mine else "all",
        alert_days=alert_days(),
        cards=OverviewCards(
            to_triage=stage_rows.get(Stage.new.value, 0),
            to_triage_last_24h=to_triage_24h,
            waiting_client=stage_rows.get(Stage.finalist.value, 0),
            waiting_client_too_long=waiting_long,
            jobs_without_candidates=sum(1 for row in published_rows if row.applications == 0),
            hires_this_month=hires.scalar() or 0,
            jobs_in_progress=len(published_rows),
        ),
        stage_counts=[StageCount(stage=stage.value, label=STAGE_LABELS[stage], count=stage_rows.get(stage.value, 0)) for stage in BOARD_STAGES],
        jobs_summary=JobsSummary(
            approved=status_rows.get("approved", 0),
            draft=status_rows.get("draft", 0) + status_rows.get("pending", 0),
            closed=status_rows.get("closed", 0) + status_rows.get("hidden", 0),
            archived=status_rows.get("archived", 0),
            active_companies=db.query(func.count(Company.id)).filter(Company.is_active.is_(True)).scalar() or 0,
        ),
        activity=_activity(db, scope_ids),
        jobs_in_progress=published_rows[:PAGE_SIZE],
    )


# --- jobs list --------------------------------------------------------------------------------------------------------


def list_jobs(
    db: Session,
    actor: User,
    *,
    status: str | None = None,
    company_id: int | None = None,
    recruiter_id: int | None = None,
    no_recruiter: bool = False,
    mine: bool = False,
    include_archived: bool = False,
    focus: str | None = None,
    page: int = 1,
) -> JobsListResponse:
    query = _scoped_jobs(db, actor)
    if company_id:
        query = query.filter(Job.company_id == company_id)
    if is_restricted(actor):
        pass  # already only their own jobs: the responsible filters do not apply
    elif mine:
        query = query.filter(Job.recruiter_id == actor.id)
    elif no_recruiter:
        query = query.filter(Job.recruiter_id.is_(None))
    elif recruiter_id:
        query = query.filter(Job.recruiter_id == recruiter_id)

    archived_hidden = 0
    if status == "archived":
        query = query.filter(Job.status == "archived")
    else:
        if status:
            query = query.filter(Job.status == status)
        if not include_archived:
            archived_hidden = query.filter(Job.status == "archived").count()
            query = query.filter(Job.status != "archived")

    jobs = sorted(
        query.all(),
        key=lambda job: (STATUS_ORDER.get(job.status, 9), -(as_utc(job.published_at or job.created_at).timestamp())),
    )
    rows = job_rows(db, jobs)
    # Overview cards: jobs with someone to triage, with the client, or published with nobody yet.
    if focus == "to_triage":
        rows = [row for row in rows if row.to_triage > 0]
    elif focus == "with_client":
        rows = [row for row in rows if row.with_client > 0]
    elif focus == "empty":
        rows = [row for row in rows if row.status == "approved" and row.applications == 0]
    page = max(page, 1)
    return JobsListResponse(
        items=rows[(page - 1) * PAGE_SIZE : page * PAGE_SIZE],
        total=len(rows),
        page=page,
        page_size=PAGE_SIZE,
        archived_hidden=archived_hidden,
    )


def job_detail(db: Session, actor: User, job_id: int) -> PanelJobDetail:
    job = job_for(db, actor, job_id)
    row = job_rows(db, [job])[0]
    return PanelJobDetail(
        **row.model_dump(),
        description=job.description,
        requirements=job.requirements,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        work_mode=job.work_mode,
        schedule=job.schedule,
        benefits=job.benefits,
        contract_type=job.contract_type,
        show_company_to_candidates=job.show_company_to_candidates,
        closed_at=job.closed_at,
    )


# --- search -----------------------------------------------------------------------------------------------------------


def search(db: Session, actor: User, text: str, limit: int = 5) -> SearchResponse:
    term = text.strip()
    if len(term) < 2:
        return SearchResponse(candidates=[], jobs=[], companies=[])
    like = f"%{term.lower()}%"
    digits = normalize_phone(term)

    candidate_filter = [func.lower(Candidate.full_name).like(like), func.lower(Candidate.email).like(like)]
    if len(digits) >= 4:
        candidate_filter.append(Candidate.phone.like(f"%{digits}%"))
    candidates = db.query(Candidate).filter(Candidate.anonymized_at.is_(None), or_(*candidate_filter))
    job_ids = visible_job_ids(db, actor)
    if job_ids is not None:
        candidates = candidates.filter(has_application_in(job_ids))
    candidates = candidates.order_by(Candidate.full_name).limit(limit).all()
    jobs = scope_jobs(db.query(Job), actor).filter(func.lower(Job.title).like(like)).order_by(Job.created_at.desc()).limit(limit).all()
    companies = db.query(Company).filter(func.lower(Company.company_name).like(like)).order_by(Company.company_name).limit(limit).all()
    return SearchResponse(
        candidates=[
            SearchHit(kind="candidate", id=c.id, title=_candidate_name(c), detail=" · ".join(filter(None, [c.city, c.email])))
            for c in candidates
        ],
        jobs=[SearchHit(kind="job", id=j.id, title=j.title, detail=f"{j.company.company_name} · {j.status}") for j in jobs],
        companies=[
            SearchHit(kind="company", id=c.id, title=c.company_name, detail=" · ".join(filter(None, [c.city, c.state])))
            for c in companies
        ],
    )
