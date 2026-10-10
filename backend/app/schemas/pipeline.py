from datetime import datetime

from pydantic import BaseModel, Field

from app.core.pipeline import STAGE_LABELS, Stage


class StageOption(BaseModel):
    value: str
    label: str


def stage_options(stages: list[Stage]) -> list[StageOption]:
    return [StageOption(value=stage.value, label=STAGE_LABELS[stage]) for stage in stages]


def stage_label(value: str) -> str:
    try:
        return STAGE_LABELS[Stage(value)]
    except ValueError:
        return value


class StageMoveRequest(BaseModel):
    to_stage: str = Field(max_length=30)
    note: str | None = Field(default=None, max_length=4000)
    # Required when moving to "finalist": the short opinion the client company will read.
    finalist_summary: str | None = Field(default=None, max_length=4000)
    # Only with to_stage="hired": move every other active candidate of the job to "rejected" ("Vaga preenchida").
    close_other_active: bool = False
    # Only with to_stage="hired": close the job (it leaves the site). Keep it open when there are more openings.
    close_job: bool = False


class StageMoveResponse(BaseModel):
    application_id: int
    stage: str
    stage_label: str
    stage_updated_at: datetime
    allowed_next_stages: list[StageOption]
    closed_others_count: int = 0
    job_closed: bool = False


class NoteCreate(BaseModel):
    body: str = Field(max_length=4000)


class NoteRead(BaseModel):
    id: int
    body: str
    author_name: str | None
    created_at: datetime


class StageHistoryRead(BaseModel):
    from_stage: str | None
    from_stage_label: str | None
    to_stage: str
    to_stage_label: str
    changed_by_name: str | None
    changed_by_role: str
    note: str | None
    created_at: datetime


class RecruiterJobSummary(BaseModel):
    id: int
    title: str
    company_name: str
    location: str | None
    status: str
    is_active: bool
    recruiter_id: int | None
    recruiter_name: str | None
    # Visible (not hidden) applications per stage value; every stage is present, zero included.
    stage_counts: dict[str, int]
    active_count: int
    finalists_waiting: int
    # Positions the company wants to fill (optional); drives the defaults when hiring.
    openings: int | None = None


class RecruiterJobsResponse(BaseModel):
    finalist_alert_days: int
    jobs: list[RecruiterJobSummary]


class ApplicationCard(BaseModel):
    id: int
    candidate_name: str
    city: str | None
    neighborhood: str | None
    stage: str
    stage_label: str
    stage_updated_at: datetime
    screening_status: str
    screening_score: int | None
    created_at: datetime
    waiting_client_too_long: bool
    # Another visible application of the same job has the same phone or e-mail (warning only, nothing is blocked).
    possible_duplicate: bool = False
    allowed_next_stages: list[StageOption]


class JobPipelineResponse(BaseModel):
    finalist_alert_days: int
    job: RecruiterJobSummary
    applications: list[ApplicationCard]


class CandidateContact(BaseModel):
    name: str
    email: str | None
    phone: str | None
    city: str | None
    neighborhood: str | None
    desired_role: str | None
    experience_years: float | None
    skills: str | None
    linkedin_url: str | None
    portfolio_url: str | None
    has_account: bool


class ScreeningAnswerView(BaseModel):
    question: str
    answer: str


class ScreeningView(BaseModel):
    status: str
    score: int | None
    summary: str | None
    completed_at: datetime | None
    answers: list[ScreeningAnswerView]


class ApplicationDetail(BaseModel):
    id: int
    job_id: int
    job_title: str
    company_name: str
    created_at: datetime
    stage: str
    stage_label: str
    stage_updated_at: datetime
    finalist_summary: str | None
    cover_letter: str | None
    is_hidden: bool
    candidate: CandidateContact
    screening: ScreeningView
    history: list[StageHistoryRead]
    notes: list[NoteRead]
    allowed_next_stages: list[StageOption]
    # Other active, visible applications of the same job (for the "vaga preenchida" prompt on hire).
    other_active_count: int
    job_openings: int | None = None
    possible_duplicate: bool = False
