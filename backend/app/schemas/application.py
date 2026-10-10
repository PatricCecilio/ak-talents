from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ApplicationCreate(BaseModel):
    job_id: int
    cover_letter: str | None = Field(default=None, max_length=5000)


class ApplicationRead(BaseModel):
    id: int
    candidate_id: int
    job_id: int
    cover_letter: str | None
    status: str
    privacy_accepted_at: datetime | None = None
    screening_status: str
    screening_score: int | None = None
    screening_summary: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PublicApplicationCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=180)
    email: EmailStr
    phone: str = Field(min_length=8, max_length=40)
    city: str = Field(min_length=2, max_length=180)
    # Optional: many candidates skip it on the phone.
    neighborhood: str | None = Field(default=None, max_length=180)
    privacy_accepted: bool

    model_config = ConfigDict(extra="forbid")

    @field_validator("neighborhood")
    @classmethod
    def _blank_neighborhood_is_none(cls, value: str | None) -> str | None:
        return (value or "").strip() or None


class PublicApplicationRead(BaseModel):
    status: str
    screening_status: str
    # True when there is nothing left for the candidate to answer (e.g. job without questions).
    screening_completed: bool = False
    public_screening_token: str
    application_reference: str
    message: str
