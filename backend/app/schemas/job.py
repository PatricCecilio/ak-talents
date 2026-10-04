from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.schemas.screening import PublicScreeningQuestionRead


class JobBase(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    description: str = Field(min_length=10)
    requirements: str | None = Field(default=None, max_length=5000)
    salary_min: float | None = Field(default=None, ge=0)
    salary_max: float | None = Field(default=None, ge=0)
    location: str | None = Field(default=None, max_length=180)
    work_mode: str | None = Field(default=None, max_length=80)


class JobCreate(JobBase):
    @model_validator(mode="after")
    def _salary_range_is_ordered(self) -> "JobCreate":
        if self.salary_min is not None and self.salary_max is not None and self.salary_min > self.salary_max:
            raise ValueError("O salário mínimo não pode ser maior que o salário máximo.")
        return self


class JobRead(JobBase):
    id: int
    company_id: int
    slug: str
    status: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PublicJobRead(JobBase):
    id: int
    slug: str
    created_at: datetime
    screening_questions: list[PublicScreeningQuestionRead] = []

    model_config = {"from_attributes": True}
