from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(180), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    state: Mapped[str | None] = mapped_column(String(80), nullable=True)
    desired_role: Mapped[str | None] = mapped_column(String(180), nullable=True)
    headline: Mapped[str | None] = mapped_column(String(180), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    skills: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(180), nullable=True)
    neighborhood: Mapped[str | None] = mapped_column(String(180), nullable=True)
    work_mode: Mapped[str | None] = mapped_column(String(80), nullable=True)
    salary_expectation: Mapped[float | None] = mapped_column(Float, nullable=True)
    experience_years: Mapped[float | None] = mapped_column(Float, nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    resume_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Migration 0015. source: "site" (public form), "conta" (account) or "manual" (registered by AK).
    source: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # Manual registration: who registered and when the candidate's authorization was recorded.
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    authorization_recorded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Personal data erased on request (LGPD): the row stays only so the anonymous counts remain right.
    anonymized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user = relationship("User", back_populates="candidate_profile", foreign_keys=[user_id])
    applications = relationship("Application", back_populates="candidate")
