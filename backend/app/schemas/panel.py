"""Read/write models of the new panel (/painel): overview, jobs, candidates, team, search."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.candidate import normalize_optional_url


# --- shared ----------------------------------------------------------------------------------------------------------


class StageCount(BaseModel):
    stage: str
    label: str
    count: int


class PanelJobRow(BaseModel):
    id: int
    title: str
    slug: str
    company_id: int
    company_name: str
    location: str | None
    recruiter_id: int | None
    recruiter_name: str | None
    status: str
    openings: int | None
    applications: int
    to_triage: int
    with_client: int
    # Candidates "Enviado ao cliente" for longer than the alert (FINALIST_ALERT_DAYS).
    waiting_client_too_long: int
    published_at: datetime | None
    created_at: datetime
    company_is_active: bool


class Page(BaseModel):
    total: int
    page: int
    page_size: int


# --- overview -------------------------------------------------------------------------------------------------------


class OverviewCards(BaseModel):
    to_triage: int
    to_triage_last_24h: int
    waiting_client: int
    waiting_client_too_long: int
    jobs_without_candidates: int
    hires_this_month: int
    jobs_in_progress: int


class JobsSummary(BaseModel):
    approved: int
    draft: int
    closed: int
    archived: int
    active_companies: int


class ActivityItem(BaseModel):
    kind: str  # new_application, sent_to_client, client_approved, client_rejected, hired, job_published
    title: str
    detail: str
    at: datetime
    job_id: int | None = None
    application_id: int | None = None


class OverviewResponse(BaseModel):
    scope: str  # "all" (admin) or "mine" (recruiter: only their jobs)
    alert_days: int
    cards: OverviewCards
    stage_counts: list[StageCount]
    jobs_summary: JobsSummary
    activity: list[ActivityItem]
    jobs_in_progress: list[PanelJobRow]


class JobsListResponse(Page):
    items: list[PanelJobRow]
    archived_hidden: int


# --- candidates -----------------------------------------------------------------------------------------------------


class CandidateRow(BaseModel):
    id: int
    name: str
    email: str | None
    phone: str | None
    city: str | None
    latest_stage: str | None
    latest_stage_label: str
    applications: int
    has_account: bool
    source: str | None


class CandidatesListResponse(Page):
    items: list[CandidateRow]
    cities: list[str]


class CandidateApplicationRow(BaseModel):
    id: int
    job_id: int
    job_title: str
    company_name: str
    stage: str
    stage_label: str
    created_at: datetime
    stage_updated_at: datetime
    is_hidden: bool


class CandidateDetail(BaseModel):
    id: int
    name: str
    email: str | None
    phone: str | None
    city: str | None
    neighborhood: str | None
    state: str | None
    desired_role: str | None
    experience_years: float | None
    skills: str | None
    linkedin_url: str | None
    portfolio_url: str | None
    resume_url: str | None
    has_account: bool
    source: str | None
    source_label: str
    created_by_name: str | None
    authorization_recorded_at: datetime | None
    created_at: datetime
    applications: list[CandidateApplicationRow]


def _blank(value):
    return (value.strip() or None) if isinstance(value, str) else value


class CandidateWrite(BaseModel):
    """Data the AK team edits (or types in a manual registration). Same essentials as the public form."""

    full_name: str = Field(min_length=2, max_length=180)
    phone: str = Field(min_length=8, max_length=40)
    city: str = Field(min_length=2, max_length=180)
    email: EmailStr | None = None
    neighborhood: str | None = Field(default=None, max_length=180)
    state: str | None = Field(default=None, max_length=80)
    desired_role: str | None = Field(default=None, max_length=180)
    experience_years: float | None = Field(default=None, ge=0, le=80)
    skills: str | None = Field(default=None, max_length=5000)
    linkedin_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)
    resume_url: str | None = Field(default=None, max_length=500)

    @field_validator("full_name", "phone", "city", mode="before")
    @classmethod
    def _strip(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("email", "neighborhood", "state", "desired_role", "skills", mode="before")
    @classmethod
    def _optional(cls, value):
        return _blank(value)

    @field_validator("linkedin_url", "portfolio_url", "resume_url", mode="before")
    @classmethod
    def _link(cls, value):
        try:
            return normalize_optional_url(value)
        except ValueError:
            raise ValueError("Confira o link: use um endereço como https://site.com.br") from None


class ManualCandidateCreate(CandidateWrite):
    # The candidate agreed (e.g. on WhatsApp) to have their data used by AK. Required, recorded with date and author.
    authorization_confirmed: bool
    # Optional: put the candidate straight into a job ("Nova").
    job_id: int | None = None


class ReferRequest(BaseModel):
    job_id: int


class ReferResponse(BaseModel):
    application_id: int
    job_id: int


class ErasureRequest(BaseModel):
    # The candidate's current name, typed again (strong confirmation).
    confirmation: str = Field(max_length=180)


class ErasureResponse(BaseModel):
    candidate_id: int
    applications_count: int
    files_deleted: int


# --- team ------------------------------------------------------------------------------------------------------------


class TeamMemberRow(BaseModel):
    id: int
    name: str
    email: str
    role: str
    role_label: str
    is_active: bool
    active_jobs: int
    candidates_in_progress: int
    hires_this_month: int
    last_activity_at: datetime | None


class TeamJobRow(BaseModel):
    id: int
    title: str
    company_name: str
    status: str
    published_at: datetime | None
    stage_counts: dict[str, int]


class TeamNote(BaseModel):
    id: int
    application_id: int
    candidate_name: str
    job_title: str
    kind: str
    kind_label: str
    body: str
    created_at: datetime


class TeamMemberCards(BaseModel):
    active_jobs: int
    closed_this_month: int
    to_triage: int
    oldest_to_triage_at: datetime | None
    with_client: int
    oldest_with_client_at: datetime | None
    hires_this_month: int
    average_days_to_hire: float | None


class TeamMemberDetail(BaseModel):
    member: TeamMemberRow
    cards: TeamMemberCards
    jobs: list[TeamJobRow]
    notes: list[TeamNote]


class TeamMemberUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr

    @field_validator("name", mode="before")
    @classmethod
    def _strip(cls, value):
        return value.strip() if isinstance(value, str) else value


# --- search ----------------------------------------------------------------------------------------------------------


class SearchHit(BaseModel):
    kind: str  # candidate, job, company
    id: int
    title: str
    detail: str


class SearchResponse(BaseModel):
    candidates: list[SearchHit]
    jobs: list[SearchHit]
    companies: list[SearchHit]
