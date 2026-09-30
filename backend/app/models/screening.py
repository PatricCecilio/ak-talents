from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class ScreeningQuestion(Base):
    __tablename__ = "screening_questions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True, nullable=False)
    key: Mapped[str] = mapped_column(String(120), nullable=False)
    label: Mapped[str] = mapped_column(String(500), nullable=False)
    question_type: Mapped[str] = mapped_column(String(40), nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    options: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    rule: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    job = relationship("Job", back_populates="screening_questions")
    answers = relationship("ScreeningAnswer", back_populates="question")


class ScreeningAnswer(Base):
    __tablename__ = "screening_answers"
    __table_args__ = (UniqueConstraint("application_id", "question_id", name="uq_application_screening_answer"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    question_id: Mapped[int] = mapped_column(ForeignKey("screening_questions.id", ondelete="CASCADE"), nullable=False)
    value_bool: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    value_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_select: Mapped[str | None] = mapped_column(String(180), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    application = relationship("Application", back_populates="screening_answers")
    question = relationship("ScreeningQuestion", back_populates="answers")
