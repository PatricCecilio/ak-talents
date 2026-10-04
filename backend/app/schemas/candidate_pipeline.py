from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class CandidateApplicationView(BaseModel):
    id: int
    job_title: str
    job_location: str | None
    # Only when the job has show_company_to_candidates turned on.
    company_name: str | None
    applied_at: datetime
    updated_at: datetime
    status_label: str
    # 1..4 in the timeline (Recebida, Em análise, Entrevista, Na etapa final); null when closed.
    step: int | None
    outcome: Literal["in_progress", "hired", "closed"]


class CandidateApplicationsResponse(BaseModel):
    steps: list[str]
    applications: list[CandidateApplicationView]


class CompanyVisibilityUpdate(BaseModel):
    show_company_to_candidates: bool
