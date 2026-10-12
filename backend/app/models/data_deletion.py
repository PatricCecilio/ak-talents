from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class DataDeletionLog(Base):
    """Who erased a candidate's personal data (LGPD) and when. Never stores the erased data itself."""

    __tablename__ = "data_deletion_log"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    # The anonymized row stays (counts), so this keeps pointing to it.
    candidate_id: Mapped[int | None] = mapped_column(ForeignKey("candidates.id", ondelete="SET NULL"), index=True, nullable=True)
    performed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    applications_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    files_deleted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    performed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
