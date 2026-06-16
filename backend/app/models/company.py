from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    company_name: Mapped[str] = mapped_column(String(180), nullable=False)
    responsible_name: Mapped[str | None] = mapped_column(String(180), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    city: Mapped[str | None] = mapped_column(String(180), nullable=True)
    state: Mapped[str | None] = mapped_column(String(80), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(180), nullable=True)
    company_size: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="pending", nullable=False)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user = relationship("User", back_populates="company_profile")
    jobs = relationship("Job", back_populates="company")
