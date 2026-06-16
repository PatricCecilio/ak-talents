from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("candidate_id", "job_id", name="uq_candidate_job_application"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    cover_letter: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="submitted", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    candidate = relationship("Candidate", back_populates="applications")
    job = relationship("Job", back_populates="applications")
