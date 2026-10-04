"""Per-job flag to show the client company name to candidates (off by default).

Revision ID: 0010_job_company_visibility
Revises: 0009_application_pipeline
Create Date: 2026-10-04
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision: str = "0010_job_company_visibility"
down_revision: Union[str, None] = "0009_application_pipeline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns() -> set[str]:
    return {column["name"] for column in inspect(op.get_bind()).get_columns("jobs")}


def upgrade() -> None:
    if "show_company_to_candidates" not in _columns():
        op.add_column(
            "jobs",
            sa.Column("show_company_to_candidates", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    if "show_company_to_candidates" in _columns():
        with op.batch_alter_table("jobs") as batch:
            batch.drop_column("show_company_to_candidates")
