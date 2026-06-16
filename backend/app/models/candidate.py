from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(180), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    state: Mapped[str | None] = mapped_column(String(80), nullable=True)
    desired_role: Mapped[str | None] = mapped_column(String(180), nullable=True)
    headline: Mapped[str | None] = mapped_column(String(180), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    skills: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(180), nullable=True)
    work_mode: Mapped[str | None] = mapped_column(String(80), nullable=True)
    salary_expectation: Mapped[float | None] = mapped_column(Float, nullable=True)
    experience_years: Mapped[float | None] = mapped_column(Float, nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    resume_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user = relationship("User", back_populates="candidate_profile")
    applications = relationship("Application", back_populates="candidate")
