from datetime import datetime

from pydantic import BaseModel, Field


class CompanyProfileUpdate(BaseModel):
    company_name: str | None = Field(default=None, max_length=180)
    responsible_name: str | None = Field(default=None, max_length=180)
    phone: str | None = Field(default=None, max_length=40)
    city: str | None = Field(default=None, max_length=180)
    state: str | None = Field(default=None, max_length=80)
    industry: str | None = Field(default=None, max_length=180)
    company_size: str | None = Field(default=None, max_length=80)
    description: str | None = Field(default=None, max_length=5000)
    website_url: str | None = Field(default=None, max_length=500)


class CompanyProfileRead(CompanyProfileUpdate):
    id: int
    user_id: int
    company_name: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
