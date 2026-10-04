from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.services.token_service import generate_appintelli_reference


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("candidate_id", "job_id", name="uq_candidate_job_application"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    cover_letter: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="submitted", nullable=False)
    privacy_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    privacy_policy_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    appintelli_reference: Mapped[str] = mapped_column(
        String(64), default=generate_appintelli_reference, unique=True, index=True, nullable=False
    )
    public_screening_token_hash: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    screening_status: Mapped[str] = mapped_column(String(50), default="pending_screening", nullable=False)
    screening_score: Mapped[int | None] = mapped_column(nullable=True)
    screening_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    screening_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    # Pipeline (app/core/pipeline.py). `stage` is the source of truth; `status` above is legacy.
    stage: Mapped[str] = mapped_column(String(30), default="new", index=True, nullable=False)
    stage_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    # Short AK opinion the client company reads when the candidate becomes a finalist.
    finalist_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Test/irrelevant applications hidden from every list and count by the admin.
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    candidate = relationship("Candidate", back_populates="applications")
    job = relationship("Job", back_populates="applications")
    screening_answers = relationship("ScreeningAnswer", back_populates="application", cascade="all, delete-orphan")
    stage_history = relationship(
        "ApplicationStageHistory",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="(ApplicationStageHistory.created_at, ApplicationStageHistory.id)",
    )
    notes = relationship(
        "ApplicationNote",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="(ApplicationNote.created_at, ApplicationNote.id)",
    )
