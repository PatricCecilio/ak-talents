from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class LoginCode(Base):
    """One-time code handing a Google redirect result from the API back to the site (migration 0013).

    Only the SHA-256 of the code is stored. purpose="session": exchanged once for the API session token.
    purpose="consent": a new account still needs the privacy consent; keeps the Google identity verified by the API
    until the person accepts (the account is only created then).
    """

    __tablename__ = "login_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    purpose: Mapped[str] = mapped_column(String(20), nullable=False)
    door: Mapped[str] = mapped_column(String(20), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    google_sub: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    created_account: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    linked_account: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    linked_applications: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
