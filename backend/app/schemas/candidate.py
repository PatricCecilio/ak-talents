from datetime import datetime
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

from app.core import messages
from app.services.identity_service import normalize_phone

# Same rule as the public application form: DDD + number, with or without the country code.
MIN_PHONE_DIGITS = 8
MAX_PHONE_DIGITS = 15

URL_FIELD_MESSAGES = {
    "linkedin_url": messages.INVALID_LINKEDIN_URL,
    "portfolio_url": messages.INVALID_PORTFOLIO_URL,
    "resume_url": messages.INVALID_RESUME_URL,
}


def normalize_optional_url(value: str | None) -> str | None:
    """Blank -> None; "linkedin.com/in/ana" -> "https://linkedin.com/in/ana". Raises ValueError if it is not a link."""
    text = (value or "").strip()
    if not text:
        return None
    if "://" not in text:
        text = f"https://{text}"
    parsed = urlparse(text)
    host = parsed.hostname or ""
    if parsed.scheme not in ("http", "https") or "." not in host or " " in text or host.startswith(".") or host.endswith("."):
        raise ValueError
    return text


class CandidateProfileUpdate(BaseModel):
    """What the candidate saves in "Meu perfil". Only name, phone/WhatsApp and city are required (the e-mail is the
    account's). Everything else is optional; links are checked only when filled in."""

    full_name: str = Field(max_length=180)
    phone: str = Field(max_length=40)
    city: str = Field(max_length=180)
    state: str | None = Field(default=None, max_length=80)
    desired_role: str | None = Field(default=None, max_length=180)
    professional_summary: str | None = Field(default=None, max_length=5000)
    skills: str | None = Field(default=None, max_length=5000)
    experience_years: float | None = Field(default=None, ge=0, le=80)
    salary_expectation: float | None = Field(default=None, ge=0)
    work_mode: Literal["remote", "hybrid", "onsite"] | None = None
    linkedin_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)
    resume_url: str | None = Field(default=None, max_length=500)

    @field_validator("state", "desired_role", "professional_summary", "skills", "work_mode", mode="before")
    @classmethod
    def _blank_is_none(cls, value):
        return (value.strip() or None) if isinstance(value, str) else value

    @field_validator("full_name")
    @classmethod
    def _name_required(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError(messages.PROFILE_NAME_REQUIRED)
        return value

    @field_validator("phone")
    @classmethod
    def _phone_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError(messages.PROFILE_PHONE_REQUIRED)
        if not MIN_PHONE_DIGITS <= len(normalize_phone(value)) <= MAX_PHONE_DIGITS:
            raise ValueError(messages.INVALID_PHONE)
        return value

    @field_validator("city")
    @classmethod
    def _city_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError(messages.PROFILE_CITY_REQUIRED)
        return value

    @field_validator("linkedin_url", "portfolio_url", "resume_url", mode="before")
    @classmethod
    def _optional_link(cls, value, info):
        try:
            return normalize_optional_url(value)
        except ValueError:
            raise ValueError(URL_FIELD_MESSAGES[info.field_name]) from None


class CandidateProfileRead(BaseModel):
    # Profiles created before these rules may still have empty fields.
    id: int
    user_id: int
    email: str | None = None
    full_name: str | None = None
    phone: str | None = None
    city: str | None = None
    state: str | None = None
    desired_role: str | None = None
    professional_summary: str | None = None
    skills: str | None = None
    experience_years: float | None = None
    salary_expectation: float | None = None
    work_mode: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    resume_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
