"""Job details candidates ask about first: schedule, benefits, contract type and number of openings.

Only adds nullable columns (no data is changed), so the API already in production keeps working with the
migrated database.

Revision ID: 0011_job_details
Revises: 0010_job_company_visibility
Create Date: 2026-10-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision: str = "0011_job_details"
down_revision: Union[str, None] = "0010_job_company_visibility"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_COLUMNS = (
    ("schedule", sa.String(length=180)),
    ("benefits", sa.Text()),
    ("contract_type", sa.String(length=20)),
    ("openings", sa.Integer()),
)


def _columns() -> set[str]:
    return {column["name"] for column in inspect(op.get_bind()).get_columns("jobs")}


def upgrade() -> None:
    existing = _columns()
    for name, column_type in NEW_COLUMNS:
        if name not in existing:
            op.add_column("jobs", sa.Column(name, column_type, nullable=True))


def downgrade() -> None:
    existing = _columns()
    with op.batch_alter_table("jobs") as batch:
        for name, _ in reversed(NEW_COLUMNS):
            if name in existing:
                batch.drop_column(name)
