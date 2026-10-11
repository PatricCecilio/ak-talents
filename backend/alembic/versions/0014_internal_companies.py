"""Companies become internal AK records; jobs get the draft / published / closed statuses.

- companies.user_id accepts NULL (a client company no longer needs a login);
- new companies columns: cnpj, contact_email, notes and is_active (copied from the company's account);
- job statuses: "pending" -> "draft" and "hidden" -> "closed" (only "approved" jobs are public, as before).

No row is deleted. The API in production keeps working with the migrated database (every company there still has
an account; a "draft" job is simply not public, like a "pending" one).

Revision ID: 0014_internal_companies
Revises: 0013_login_codes
Create Date: 2026-10-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision: str = "0014_internal_companies"
down_revision: Union[str, None] = "0013_login_codes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_COLUMNS = (
    ("cnpj", sa.String(length=14), None),
    ("contact_email", sa.String(length=255), None),
    ("notes", sa.Text(), None),
    ("is_active", sa.Boolean(), sa.true()),
)


def _company_columns() -> dict[str, dict]:
    return {column["name"]: column for column in inspect(op.get_bind()).get_columns("companies")}


def upgrade() -> None:
    columns = _company_columns()
    for name, column_type, default in NEW_COLUMNS:
        if name not in columns:
            op.add_column(
                "companies",
                sa.Column(name, column_type, nullable=default is None, server_default=default),
            )
    if "is_active" not in columns:
        # A company was "deactivated" through its account until now.
        op.execute(
            "UPDATE companies SET is_active = (SELECT users.is_active FROM users WHERE users.id = companies.user_id) "
            "WHERE user_id IS NOT NULL"
        )
    if not columns["user_id"]["nullable"]:
        with op.batch_alter_table("companies") as batch:
            batch.alter_column("user_id", existing_type=sa.Integer(), nullable=True)

    op.execute("UPDATE jobs SET status = 'draft' WHERE status = 'pending'")
    op.execute("UPDATE jobs SET status = 'closed', is_active = false WHERE status = 'hidden'")


def downgrade() -> None:
    op.execute("UPDATE jobs SET status = 'pending' WHERE status = 'draft'")
    columns = _company_columns()
    bind = op.get_bind()
    without_account = bind.execute(sa.text("SELECT count(*) FROM companies WHERE user_id IS NULL")).scalar()
    with op.batch_alter_table("companies") as batch:
        for name, _, _ in reversed(NEW_COLUMNS):
            if name in columns:
                batch.drop_column(name)
        # Companies created without an account would have to be deleted: keep the column nullable then.
        if not without_account:
            batch.alter_column("user_id", existing_type=sa.Integer(), nullable=False)
