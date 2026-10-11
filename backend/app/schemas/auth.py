from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole
from app.schemas.user import UserRead


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole
    company_name: str | None = Field(default=None, max_length=180)
    # Must be true; checked in the service so the client gets a clear Portuguese message.
    privacy_accepted: bool = False


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class GoogleSignInRequest(BaseModel):
    # ID token from Google Identity Services (the browser's "Continuar com o Google" button).
    credential: str = Field(min_length=20, max_length=4096)
    # Login door the person used: decides the account type only when a NEW account is created.
    door: Literal["candidato", "empresa"]
    # Needed only to create a new account (same rule as the sign-up form).
    privacy_accepted: bool = False


class GoogleSignInResponse(TokenResponse):
    created: bool = False
    # An existing e-mail/password account was linked to Google (its password no longer works).
    linked: bool = False
    # Public job-form applications with the same (now verified) e-mail moved into this account.
    linked_applications: int = 0
