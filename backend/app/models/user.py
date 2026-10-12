from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class UserRole(str, Enum):
    candidate = "candidate"
    company = "company"
    admin = "admin"
    recruiter = "recruiter"


# Internal AK Talent team: operates jobs and applications.
STAFF_ROLES = (UserRole.admin.value, UserRole.recruiter.value)
# The only roles anyone can pick on the public sign-up form.
PUBLIC_SIGNUP_ROLES = (UserRole.candidate.value, UserRole.company.value)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # NULL for accounts that sign in only with Google (staff accounts always have a password).
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # LGPD consent given at sign-up (null for accounts created before consent was recorded).
    privacy_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    privacy_policy_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Sign in with Google (migration 0012): proven e-mail ownership and the stable Google account id ("sub").
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    # JWTs issued before this moment are refused (e.g. sessions opened with an old password before linking Google).
    sessions_valid_after: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    candidate_profile = relationship("Candidate", back_populates="user", uselist=False, foreign_keys="Candidate.user_id")
    company_profile = relationship("Company", back_populates="user", uselist=False)
