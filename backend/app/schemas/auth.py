from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole
from app.schemas.user import UserRead


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole
    company_name: str | None = Field(default=None, max_length=180)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
