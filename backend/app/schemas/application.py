from datetime import datetime

from pydantic import BaseModel, Field


class ApplicationCreate(BaseModel):
    job_id: int
    cover_letter: str | None = Field(default=None, max_length=5000)


class ApplicationRead(BaseModel):
    id: int
    candidate_id: int
    job_id: int
    cover_letter: str | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
