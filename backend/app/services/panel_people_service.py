"""Panel (/painel): candidates (talent pool, manual registration, referral, LGPD erasure) and the AK team."""

from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core import messages
from app.core.names import normalize_person_name
from app.core.pipeline import ACTIVE_STAGES, NOTE_KINDS, STAGE_LABELS, Stage, parse_stage
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.data_deletion import DataDeletionLog
from app.models.job import Job
from app.models.pipeline import ApplicationNote, ApplicationStageHistory
from app.models.screening import ScreeningAnswer
from app.models.user import STAFF_ROLES, User
from app.schemas.panel import (
    CandidateApplicationRow,
    CandidateDetail,
    CandidateRow,
    CandidatesListResponse,
    CandidateWrite,
    ErasureResponse,
    ManualCandidateCreate,
    ReferResponse,
    TeamJobRow,
    TeamMemberCards,
    TeamMemberDetail,
    TeamMemberRow,
    TeamMemberUpdate,
    TeamNote,
)
from app.services.access import (
    application_for,
    applications_in_scope,
    ensure_candidate,
    has_application_in,
    is_restricted,
    job_for,
    visible_job_ids,
)
from app.services.admin_service import candidate_is_active
from app.services.identity_service import normalize_email, normalize_phone
from app.services.panel_service import PAGE_SIZE, as_utc, job_counts, month_start_utc, now_utc
from app.services.pipeline_service import record_initial_stage

SOURCE_LABELS = {"site": "Formulário do site", "conta": "Conta no site", "manual": "Cadastro manual pela AK"}
MANUAL_NOTE = "Cadastro manual pela AK."
ERASED_NAME = "Candidato removido"
ERASED_TEXT = "Conteúdo removido a pedido do candidato (LGPD)."
REFERABLE_STATUSES = ("approved", "draft")
ROLE_LABELS = {"admin": "Administradora", "recruiter": "Recrutadora"}


def _unprocessable(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


def _candidate_or_404(db: Session, candidate_id: int, allow_erased: bool = False) -> Candidate:
    candidate = db.get(Candidate, candidate_id)
    if candidate is None or (candidate.anonymized_at is not None and not allow_erased):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=messages.CANDIDATE_NOT_FOUND)
    return candidate


def _name(candidate: Candidate) -> str:
    return candidate.full_name or (candidate.user.name if candidate.user else None) or "Candidato"


def _email(candidate: Candidate) -> str | None:
    return candidate.email or (candidate.user.email if candidate.user else None)


def _visible(candidate: Candidate, job_ids: set[int] | None) -> list[Application]:
    return [application for application in applications_in_scope(candidate, job_ids) if not application.is_hidden]


def _latest(visible: list[Application]) -> Application | None:
    return max(visible, key=lambda application: (as_utc(application.created_at), application.id), default=None)


# --- talent pool -----------------------------------------------------------------------------------------------------


def list_candidates(
    db: Session,
    actor: User,
    *,
    stage: str | None = None,
    job_id: int | None = None,
    city: str | None = None,
    text: str | None = None,
    page: int = 1,
) -> CandidatesListResponse:
    query = db.query(Candidate).filter(Candidate.anonymized_at.is_(None))
    job_ids = visible_job_ids(db, actor)
    if job_ids is not None:
        # A recruiter's pool: only people with an application in one of their jobs.
        query = query.filter(has_application_in(job_ids))
    candidates = query.order_by(Candidate.created_at.desc(), Candidate.id.desc()).all()
    cities = sorted({(candidate.city or "").strip() for candidate in candidates if (candidate.city or "").strip()}, key=str.lower)

    term = (text or "").strip().lower()
    digits = normalize_phone(term)
    rows: list[CandidateRow] = []
    for candidate in candidates:
        visible = _visible(candidate, job_ids)
        latest = _latest(visible)
        if stage == "none" and visible:
            continue
        if stage and stage != "none" and (latest is None or latest.stage != stage):
            continue
        if job_id and not any(application.job_id == job_id for application in visible):
            continue
        if city and (candidate.city or "").strip().lower() != city.strip().lower():
            continue
        if term and not (
            term in _name(candidate).lower()
            or term in (_email(candidate) or "").lower()
            or (len(digits) >= 4 and digits in normalize_phone(candidate.phone or ""))
        ):
            continue
        rows.append(
            CandidateRow(
                id=candidate.id,
                name=_name(candidate),
                email=_email(candidate),
                phone=candidate.phone,
                city=candidate.city,
                latest_stage=latest.stage if latest else None,
                latest_stage_label=STAGE_LABELS[parse_stage(latest.stage)] if latest and parse_stage(latest.stage) else "Sem candidatura",
                applications=len(visible),
                has_account=candidate.user_id is not None,
                source=candidate.source,
                is_active=candidate_is_active(candidate),
            )
        )
    page = max(page, 1)
    return CandidatesListResponse(
        items=rows[(page - 1) * PAGE_SIZE : page * PAGE_SIZE], total=len(rows), page=page, page_size=PAGE_SIZE, cities=cities
    )


def candidate_detail(db: Session, actor: User, candidate_id: int) -> CandidateDetail:
    candidate = _candidate_or_404(db, candidate_id)
    job_ids = visible_job_ids(db, actor)
    ensure_candidate(candidate, job_ids)
    creator = db.get(User, candidate.created_by_user_id) if candidate.created_by_user_id else None
    applications = sorted(applications_in_scope(candidate, job_ids), key=lambda application: (as_utc(application.created_at), application.id), reverse=True)
    return CandidateDetail(
        id=candidate.id,
        name=_name(candidate),
        email=_email(candidate),
        phone=candidate.phone,
        city=candidate.city,
        neighborhood=candidate.neighborhood,
        state=candidate.state,
        desired_role=candidate.desired_role,
        experience_years=candidate.experience_years,
        skills=candidate.skills,
        linkedin_url=candidate.linkedin_url,
        portfolio_url=candidate.portfolio_url,
        resume_url=candidate.resume_url,
        has_account=candidate.user_id is not None,
        source=candidate.source,
        source_label=SOURCE_LABELS.get(candidate.source or "", "Não informado"),
        created_by_name=creator.name if creator else None,
        authorization_recorded_at=candidate.authorization_recorded_at,
        created_at=candidate.created_at,
        is_active=candidate_is_active(candidate),
        applications=[
            CandidateApplicationRow(
                id=application.id,
                job_id=application.job_id,
                job_title=application.job.title,
                company_name=application.job.company.company_name,
                stage=application.stage,
                stage_label=STAGE_LABELS.get(parse_stage(application.stage), application.stage),
                created_at=application.created_at,
                stage_updated_at=application.stage_updated_at,
                is_hidden=application.is_hidden,
            )
            for application in applications
        ],
    )


def _check_contact_free(db: Session, payload: CandidateWrite, exclude_id: int | None = None) -> tuple[str, str | None]:
    phone = normalize_phone(payload.phone)
    if not 8 <= len(phone) <= 15:
        raise _unprocessable(messages.INVALID_PHONE)
    email = normalize_email(str(payload.email)) if payload.email else None
    others = db.query(Candidate).filter(Candidate.anonymized_at.is_(None))
    if exclude_id:
        others = others.filter(Candidate.id != exclude_id)
    for other in others.all():
        if normalize_phone(other.phone or "") == phone or (email and (other.email or "").lower() == email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=messages.CANDIDATE_ALREADY_EXISTS)
    return phone, email


def _apply_fields(candidate: Candidate, payload: CandidateWrite, phone: str, email: str | None) -> None:
    candidate.full_name = normalize_person_name(payload.full_name)
    candidate.phone = phone
    candidate.email = email
    candidate.city = payload.city
    for field in ("neighborhood", "state", "desired_role", "experience_years", "skills", "linkedin_url", "portfolio_url", "resume_url"):
        setattr(candidate, field, getattr(payload, field))


def update_candidate(db: Session, actor: User, candidate_id: int, payload: CandidateWrite) -> CandidateDetail:
    candidate = _candidate_or_404(db, candidate_id)
    ensure_candidate(candidate, visible_job_ids(db, actor))
    phone, email = _check_contact_free(db, payload, exclude_id=candidate.id)
    if candidate.user_id is not None and email and email != normalize_email(candidate.user.email):
        # The login e-mail belongs to the person; AK only edits the contact data.
        raise _unprocessable(messages.CANDIDATE_ACCOUNT_EMAIL)
    _apply_fields(candidate, payload, phone, email if candidate.user_id is None else candidate.email)
    db.commit()
    return candidate_detail(db, actor, candidate.id)


def _job_open_for_new_applications(db: Session, actor: User, job_id: int) -> Job:
    job = job_for(db, actor, job_id)
    if job.status not in REFERABLE_STATUSES or not job.company.is_active:
        raise _unprocessable(messages.JOB_NOT_OPEN_FOR_CANDIDATES)
    return job


def _new_application(db: Session, candidate: Candidate, job: Job, note: str) -> Application:
    if db.query(Application.id).filter(Application.candidate_id == candidate.id, Application.job_id == job.id).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=messages.CANDIDATE_ALREADY_IN_JOB)
    application = Application(
        candidate_id=candidate.id,
        job_id=job.id,
        screening_status="REVIEW",
        screening_summary="Sem triagem automática (incluído pela equipe AK). A equipe AK Talent vai analisar.",
    )
    db.add(application)
    db.flush()
    record_initial_stage(db, application, note=note)
    return application


def create_manual_candidate(db: Session, actor: User, payload: ManualCandidateCreate) -> CandidateDetail:
    if not payload.authorization_confirmed:
        raise _unprocessable(messages.MANUAL_AUTHORIZATION_REQUIRED)
    if not payload.job_id and is_restricted(actor):
        # Without a job of theirs, the recruiter would not see the person they just registered.
        raise _unprocessable(messages.MANUAL_JOB_REQUIRED)
    phone, email = _check_contact_free(db, payload)
    job = _job_open_for_new_applications(db, actor, payload.job_id) if payload.job_id else None
    candidate = Candidate(source="manual", created_by_user_id=actor.id, authorization_recorded_at=now_utc())
    _apply_fields(candidate, payload, phone, email)
    db.add(candidate)
    db.flush()
    if job:
        _new_application(db, candidate, job, MANUAL_NOTE)
    db.commit()
    return candidate_detail(db, actor, candidate.id)


def refer_to_job(db: Session, actor: User, application_id: int, job_id: int) -> ReferResponse:
    """"Indicar para outra vaga": a new application in "Nova" of the other job; the current one does not change."""
    origin = application_for(db, actor, application_id)
    if origin.candidate.anonymized_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=messages.CANDIDATE_NOT_FOUND)
    if job_id == origin.job_id:
        raise _unprocessable(messages.REFER_SAME_JOB)
    job = _job_open_for_new_applications(db, actor, job_id)
    text = f"Indicado a partir da vaga {origin.job.title}."
    application = _new_application(db, origin.candidate, job, text)
    db.add(ApplicationNote(application_id=application.id, author_user_id=actor.id, kind="anotacao", body=text))
    db.commit()
    return ReferResponse(application_id=application.id, job_id=job.id)


# --- LGPD erasure ----------------------------------------------------------------------------------------------------


def _delete_resume_files(candidate: Candidate) -> int:
    """Removes stored résumé files. The site does not store files today (only a link, cleared below), so there is
    nothing to delete; if file upload is added, delete the stored file(s) here and return how many were removed."""
    return 0


def erase_candidate_data(db: Session, actor: User, candidate_id: int, confirmation: str) -> ErasureResponse:
    candidate = _candidate_or_404(db, candidate_id)
    if confirmation.strip().lower() != _name(candidate).strip().lower():
        raise _unprocessable(messages.ERASURE_CONFIRMATION_MISMATCH)

    files_deleted = _delete_resume_files(candidate)
    for field in (
        "email",
        "phone",
        "state",
        "desired_role",
        "headline",
        "bio",
        "skills",
        "city",
        "neighborhood",
        "work_mode",
        "salary_expectation",
        "experience_years",
        "linkedin_url",
        "portfolio_url",
        "resume_url",
    ):
        setattr(candidate, field, None)
    candidate.full_name = ERASED_NAME
    candidate.anonymized_at = now_utc()

    applications = list(candidate.applications)
    for application in applications:
        application.cover_letter = None
        application.finalist_summary = None
        application.screening_summary = None
        application.public_screening_token_hash = None
        db.query(ScreeningAnswer).filter(ScreeningAnswer.application_id == application.id).delete(synchronize_session=False)
        for note in application.notes:
            note.body = ERASED_TEXT
        for entry in application.stage_history:
            entry.note = None

    if candidate.user is not None:
        # The account stops working and frees the e-mail; stage counts and history (without text) remain.
        user = candidate.user
        user.is_active = False
        user.name = ERASED_NAME
        user.email = f"removido-{user.id}@anonimizado.invalid"
        user.hashed_password = None
        user.google_sub = None
        user.sessions_valid_after = now_utc().replace(microsecond=0)

    db.add(
        DataDeletionLog(
            candidate_id=candidate.id,
            performed_by_user_id=actor.id,
            applications_count=len(applications),
            files_deleted=files_deleted,
        )
    )
    db.commit()
    return ErasureResponse(candidate_id=candidate.id, applications_count=len(applications), files_deleted=files_deleted)


# --- team ------------------------------------------------------------------------------------------------------------


def _member_or_404(db: Session, user_id: int) -> User:
    member = db.get(User, user_id)
    if member is None or member.role not in STAFF_ROLES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=messages.TEAM_MEMBER_NOT_FOUND)
    return member


def _member_row(db: Session, member: User) -> TeamMemberRow:
    active_jobs = db.query(Job.id).filter(Job.recruiter_id == member.id, Job.status == "approved")
    job_ids = [job_id for (job_id,) in active_jobs.all()]
    in_progress = (
        db.query(func.count(Application.id))
        .filter(
            Application.job_id.in_(job_ids),
            Application.is_hidden.is_(False),
            Application.stage.in_([stage.value for stage in ACTIVE_STAGES]),
        )
        .scalar()
        if job_ids
        else 0
    )
    hires = (
        db.query(func.count(ApplicationStageHistory.id))
        .join(Application, ApplicationStageHistory.application_id == Application.id)
        .join(Job, Application.job_id == Job.id)
        .filter(
            Job.recruiter_id == member.id,
            ApplicationStageHistory.to_stage == Stage.hired.value,
            ApplicationStageHistory.created_at >= month_start_utc(),
        )
        .scalar()
    )
    last_move = db.query(func.max(ApplicationStageHistory.created_at)).filter(ApplicationStageHistory.changed_by_user_id == member.id).scalar()
    last_note = db.query(func.max(ApplicationNote.created_at)).filter(ApplicationNote.author_user_id == member.id).scalar()
    last = max((as_utc(value) for value in (last_move, last_note) if value is not None), default=None)
    return TeamMemberRow(
        id=member.id,
        name=member.name,
        email=member.email,
        role=member.role,
        role_label=ROLE_LABELS.get(member.role, member.role),
        is_active=member.is_active,
        active_jobs=len(job_ids),
        candidates_in_progress=in_progress or 0,
        hires_this_month=hires or 0,
        last_activity_at=last,
    )


def list_team(db: Session) -> list[TeamMemberRow]:
    members = db.query(User).filter(User.role.in_(STAFF_ROLES)).order_by(User.is_active.desc(), User.name).all()
    return [_member_row(db, member) for member in members]


def team_member_detail(db: Session, user_id: int) -> TeamMemberDetail:
    member = _member_or_404(db, user_id)
    month_start = month_start_utc()
    jobs = (
        db.query(Job)
        .filter(Job.recruiter_id == member.id, Job.status.in_(["approved", "draft", "closed"]))
        .order_by(Job.id.desc())
        .all()
    )
    # Published first, then drafts, then closed ones.
    jobs = sorted(jobs, key=lambda job: {"approved": 0, "draft": 1, "closed": 2}[job.status])[:PAGE_SIZE]
    counts = job_counts(db, [job.id for job in jobs])
    active_ids = [job_id for (job_id,) in db.query(Job.id).filter(Job.recruiter_id == member.id, Job.status == "approved").all()]
    visible = db.query(Application).filter(Application.job_id.in_(active_ids), Application.is_hidden.is_(False)) if active_ids else None
    new_dates = [as_utc(a.created_at) for a in visible.filter(Application.stage == Stage.new.value).all()] if visible is not None else []
    client_dates = [as_utc(a.stage_updated_at) for a in visible.filter(Application.stage == Stage.finalist.value).all()] if visible is not None else []

    hires = (
        db.query(ApplicationStageHistory, Job)
        .join(Application, ApplicationStageHistory.application_id == Application.id)
        .join(Job, Application.job_id == Job.id)
        .filter(Job.recruiter_id == member.id, ApplicationStageHistory.to_stage == Stage.hired.value, ApplicationStageHistory.created_at >= month_start)
        .all()
    )
    days = [
        (as_utc(entry.created_at) - as_utc(job.published_at)) / timedelta(days=1) for entry, job in hires if job.published_at is not None
    ]
    closed_this_month = (
        db.query(func.count(Job.id)).filter(Job.recruiter_id == member.id, Job.closed_at.isnot(None), Job.closed_at >= month_start).scalar()
    )

    notes = (
        db.query(ApplicationNote)
        .filter(ApplicationNote.author_user_id == member.id)
        .order_by(ApplicationNote.created_at.desc(), ApplicationNote.id.desc())
        .limit(8)
        .all()
    )
    return TeamMemberDetail(
        member=_member_row(db, member),
        cards=TeamMemberCards(
            active_jobs=len(active_ids),
            closed_this_month=closed_this_month or 0,
            to_triage=len(new_dates),
            oldest_to_triage_at=min(new_dates, default=None),
            with_client=len(client_dates),
            oldest_with_client_at=min(client_dates, default=None),
            hires_this_month=len(hires),
            average_days_to_hire=round(sum(days) / len(days), 1) if days else None,
        ),
        jobs=[
            TeamJobRow(
                id=job.id,
                title=job.title,
                company_name=job.company.company_name,
                status=job.status,
                published_at=job.published_at,
                stage_counts=counts[job.id],
            )
            for job in jobs
        ],
        notes=[
            TeamNote(
                id=note.id,
                application_id=note.application_id,
                candidate_name=_name(note.application.candidate),
                job_title=note.application.job.title,
                kind=note.kind,
                kind_label=NOTE_KINDS.get(note.kind, NOTE_KINDS["anotacao"]),
                body=note.body,
                created_at=note.created_at,
            )
            for note in notes
        ],
    )


def update_team_member(db: Session, user_id: int, payload: TeamMemberUpdate) -> TeamMemberRow:
    member = _member_or_404(db, user_id)
    email = normalize_email(str(payload.email))
    if db.query(User.id).filter(func.lower(User.email) == email, User.id != member.id).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe um usuário com este e-mail.")
    member.name = payload.name
    member.email = email
    db.commit()
    return _member_row(db, member)


def set_team_member_active(db: Session, actor: User, user_id: int, is_active: bool) -> TeamMemberRow:
    member = _member_or_404(db, user_id)
    if member.id == actor.id and not is_active:
        raise _unprocessable(messages.CANNOT_DEACTIVATE_SELF)
    member.is_active = is_active
    db.commit()
    return _member_row(db, member)

