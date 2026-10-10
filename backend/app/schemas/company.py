from datetime import datetime

from pydantic import BaseModel, Field, ValidationInfo, field_validator

REQUIRED_LABELS = {
    "company_name": "Nome da empresa",
    "responsible_name": "Responsável",
    "phone": "Telefone",
    "city": "Cidade",
    "state": "Estado",
}


class CompanyProfileFields(BaseModel):
    company_name: str | None = Field(default=None, max_length=180)
    responsible_name: str | None = Field(default=None, max_length=180)
    phone: str | None = Field(default=None, max_length=40)
    city: str | None = Field(default=None, max_length=180)
    state: str | None = Field(default=None, max_length=80)
    industry: str | None = Field(default=None, max_length=180)
    company_size: str | None = Field(default=None, max_length=80)
    description: str | None = Field(default=None, max_length=5000)
    website_url: str | None = Field(default=None, max_length=500)


class CompanyProfileUpdate(CompanyProfileFields):
    # Rules apply only to what is sent; reading keeps whatever is stored (older profiles may have blanks).
    @field_validator("company_name", "responsible_name", "phone", "city", "state")
    @classmethod
    def _required_fields_cannot_be_blank(cls, value: str | None, info: ValidationInfo) -> str | None:
        # Optional in the request (the AI assistant sends only part of the profile), but never blanked out.
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError(f"Preencha o campo {REQUIRED_LABELS[info.field_name]}.")
        return value

    @field_validator("industry", "company_size", "description", "website_url")
    @classmethod
    def _blank_optional_is_none(cls, value: str | None) -> str | None:
        return (value or "").strip() or None


class CompanyProfileRead(CompanyProfileFields):
    id: int
    user_id: int
    company_name: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
