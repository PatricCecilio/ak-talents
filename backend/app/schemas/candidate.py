from datetime import datetime

from pydantic import BaseModel, Field


class CandidateProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=180)
    phone: str | None = Field(default=None, max_length=40)
    city: str | None = Field(default=None, max_length=180)
    state: str | None = Field(default=None, max_length=80)
    desired_role: str | None = Field(default=None, max_length=180)
    professional_summary: str | None = Field(default=None, max_length=5000)
    skills: str | None = Field(default=None, max_length=5000)
    experience_years: float | None = Field(default=None, ge=0)
    salary_expectation: float | None = Field(default=None, ge=0)
    work_mode: str | None = Field(default=None, max_length=80)
    linkedin_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)


class CandidateProfileRead(CandidateProfileUpdate):
    id: int
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}
