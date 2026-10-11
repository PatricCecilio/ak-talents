from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Company(Base):
    """Client company. Since migration 0014 it is an internal AK record: it may have no login at all (user_id NULL)."""

    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    # Only companies from the old self-service portal have an account.
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=True)
    company_name: Mapped[str] = mapped_column(String(180), nullable=False)
    responsible_name: Mapped[str | None] = mapped_column(String(180), nullable=True)
    # The contact's WhatsApp (where AK sends the candidate reports).
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    city: Mapped[str | None] = mapped_column(String(180), nullable=True)
    state: Mapped[str | None] = mapped_column(String(80), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(180), nullable=True)
    company_size: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="pending", nullable=False)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Internal record fields (migration 0014). Only digits in cnpj.
    cnpj: Mapped[str | None] = mapped_column(String(14), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Deactivated (never deleted): its jobs leave the site and the AK lists.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user = relationship("User", back_populates="company_profile")
    jobs = relationship("Job", back_populates="company")
