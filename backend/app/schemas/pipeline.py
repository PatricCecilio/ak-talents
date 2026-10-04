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


class StageMoveResponse(BaseModel):
    application_id: int
    stage: str
    stage_label: str
    stage_updated_at: datetime
    allowed_next_stages: list[StageOption]
    closed_others_count: int = 0


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
