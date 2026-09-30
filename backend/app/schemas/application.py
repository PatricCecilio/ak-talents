from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


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
    neighborhood: str = Field(min_length=2, max_length=180)
    privacy_accepted: bool

    model_config = ConfigDict(extra="forbid")


class PublicApplicationRead(BaseModel):
    status: str
    screening_status: str
    public_screening_token: str
    application_reference: str
    message: str
