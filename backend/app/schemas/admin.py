from datetime import datetime

from pydantic import BaseModel, EmailStr


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


class AdminCompanyRead(BaseModel):
    id: int
    user_id: int
    company_name: str
    responsible_name: str | None
    email: EmailStr
    city: str | None
    state: str | None
    industry: str | None
    company_size: str | None
    status: str
    created_at: datetime


class AdminJobRead(BaseModel):
    id: int
    company_id: int
    company_name: str
    title: str
    location: str | None
    work_mode: str | None
    status: str
    is_active: bool
    created_at: datetime


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
