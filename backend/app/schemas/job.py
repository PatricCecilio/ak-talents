from datetime import datetime

from pydantic import BaseModel, Field


class JobBase(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    description: str = Field(min_length=10)
    requirements: str | None = Field(default=None, max_length=5000)
    salary_min: float | None = Field(default=None, ge=0)
    salary_max: float | None = Field(default=None, ge=0)
    location: str | None = Field(default=None, max_length=180)
    work_mode: str | None = Field(default=None, max_length=80)


class JobCreate(JobBase):
    pass


class JobRead(JobBase):
    id: int
    company_id: int
    status: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
