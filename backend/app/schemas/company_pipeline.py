from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.job import JobRead


class CompanyFinalist(BaseModel):
    application_id: int
    job_id: int
    job_title: str
    candidate_name: str
    city: str | None
    experience_years: float | None
    finalist_summary: str | None
    # "pending" = waiting for the company; "approved" = approved for interview (or hired).
    status: Literal["pending", "approved"]
    updated_at: datetime
    # Released only after the company approves the finalist.
    phone: str | None = None
    email: str | None = None


class CompanyFinalistsResponse(BaseModel):
    pending: list[CompanyFinalist]
    approved: list[CompanyFinalist]


class FinalistDecision(BaseModel):
    decision: Literal["approve", "reject"]
    reason: str | None = Field(default=None, max_length=1000)


class CompanyJobRead(JobRead):
    # Number of (visible) applications per stage; no candidate names.
    stage_counts: dict[str, int]
