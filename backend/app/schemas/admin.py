from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.job import JobCreate, JobRead

# Job lifecycle operated by AK: draft (Rascunho), approved (Publicada, the only public one), closed (Encerrada).
JobStatus = Literal["draft", "approved", "closed"]


class AdminUserRead(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminCandidateRead(BaseModel):
    id: int
    user_id: int | None
    name: str
    email: EmailStr | None
    phone: str | None
    city: str | None
    neighborhood: str | None
    desired_role: str | None
    skills: str | None
    experience_years: float | None
    salary_expectation: float | None
    work_mode: str | None
    created_at: datetime
    is_active: bool = True



class AdminCompanyRead(BaseModel):
    id: int
    user_id: int | None
    company_name: str
    responsible_name: str | None
    # Account e-mail (old portal companies only).
    email: EmailStr | None
    city: str | None
    state: str | None
    industry: str | None
    company_size: str | None
    status: str
    created_at: datetime
    is_active: bool = True
    cnpj: str | None = None
    whatsapp: str | None = None
    contact_email: str | None = None
    notes: str | None = None
    has_account: bool = False
    jobs_count: int = 0


def _blank_is_none(value):
    return (value.strip() or None) if isinstance(value, str) else value


class CompanyWrite(BaseModel):
    """Internal client company record (created and edited by the AK admin)."""

    company_name: str = Field(min_length=2, max_length=180)
    cnpj: str | None = Field(default=None, max_length=20)
    responsible_name: str | None = Field(default=None, max_length=180)
    whatsapp: str = Field(min_length=8, max_length=40)
    contact_email: EmailStr | None = None
    city: str | None = Field(default=None, max_length=180)
    state: str | None = Field(default=None, max_length=2)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("cnpj", "responsible_name", "contact_email", "city", "state", "notes", mode="before")
    @classmethod
    def _blank(cls, value):
        return _blank_is_none(value)

    @field_validator("company_name", "whatsapp", mode="before")
    @classmethod
    def _strip(cls, value):
        return value.strip() if isinstance(value, str) else value


class AdminJobWrite(JobCreate):
    """A job opened by AK for a client company: published right away, no approval step."""

    company_id: int
    recruiter_id: int | None = None
    status: JobStatus = "draft"


class AdminJobDetail(JobRead):
    company_name: str
    recruiter_id: int | None = None
    show_company_to_candidates: bool = False



class AdminJobRead(BaseModel):
    id: int
    company_id: int
    company_name: str
    title: str
    location: str | None
    work_mode: str | None
    status: str
    openings: int | None = None
    company_is_active: bool = True
    is_active: bool
    created_at: datetime
    recruiter_id: int | None = None
    recruiter_name: str | None = None
    show_company_to_candidates: bool = False


class StaffMemberRead(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class RecruiterCreate(BaseModel):
    # Name, e-mail and password rules are checked in staff_service so errors come back in Portuguese.
    name: str = Field(max_length=150)
    email: str = Field(max_length=255)
    password: str = Field(max_length=128)


class JobResponsibleUpdate(BaseModel):
    recruiter_id: int | None = None


class AdminApplicationRead(BaseModel):
    id: int
    candidate_id: int
    candidate_name: str
    candidate_phone: str | None
    candidate_city: str | None
    candidate_neighborhood: str | None
    job_id: int
    job_title: str
    status: str
    screening_status: str
    screening_score: int | None
    screening_summary: str | None
    created_at: datetime
    is_hidden: bool = False
    stage: str = "new"
    stage_label: str = "Nova"


class ActiveUpdate(BaseModel):
    is_active: bool


class HiddenUpdate(BaseModel):
    is_hidden: bool
