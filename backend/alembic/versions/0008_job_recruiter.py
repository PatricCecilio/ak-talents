"""Optional responsible recruiter on jobs.

Revision ID: 0008_job_recruiter
Revises: 0007_privacy_consent
Create Date: 2026-10-04
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision: str = "0008_job_recruiter"
down_revision: Union[str, None] = "0007_privacy_consent"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if "recruiter_id" not in {column["name"] for column in inspector.get_columns("jobs")}:
        # batch mode recreates the table on SQLite (no ALTER ... ADD CONSTRAINT there); plain ALTER on PostgreSQL.
        with op.batch_alter_table("jobs") as batch:
            batch.add_column(sa.Column("recruiter_id", sa.Integer(), nullable=True))
            batch.create_foreign_key("fk_jobs_recruiter_id_users", "users", ["recruiter_id"], ["id"], ondelete="SET NULL")
            batch.create_index("ix_jobs_recruiter_id", ["recruiter_id"])


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if "recruiter_id" in {column["name"] for column in inspector.get_columns("jobs")}:
        with op.batch_alter_table("jobs") as batch:
            batch.drop_index("ix_jobs_recruiter_id")
            batch.drop_constraint("fk_jobs_recruiter_id_users", type_="foreignkey")
            batch.drop_column("recruiter_id")
