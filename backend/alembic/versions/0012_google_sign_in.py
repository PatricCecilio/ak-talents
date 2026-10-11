"""Sign in with Google: verified e-mail, Google account id, session cut-off and password-less accounts.

Additive only: three nullable columns and users.hashed_password accepting NULL (Google-only accounts, and accounts
whose old password was invalidated when linked to Google). The API already in production keeps working with the
migrated database (until the new code ships, every account still has a password).

Revision ID: 0012_google_sign_in
Revises: 0011_job_details
Create Date: 2026-10-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision: str = "0012_google_sign_in"
down_revision: Union[str, None] = "0011_job_details"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

GOOGLE_SUB_INDEX = "ix_users_google_sub"


def _columns() -> dict[str, dict]:
    return {column["name"]: column for column in inspect(op.get_bind()).get_columns("users")}


def _indexes() -> set[str]:
    return {index["name"] for index in inspect(op.get_bind()).get_indexes("users")}


def upgrade() -> None:
    columns = _columns()
    with op.batch_alter_table("users") as batch:
        if "email_verified_at" not in columns:
            batch.add_column(sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
        if "google_sub" not in columns:
            batch.add_column(sa.Column("google_sub", sa.String(length=255), nullable=True))
        if "sessions_valid_after" not in columns:
            batch.add_column(sa.Column("sessions_valid_after", sa.DateTime(timezone=True), nullable=True))
        if not columns["hashed_password"]["nullable"]:
            batch.alter_column("hashed_password", existing_type=sa.String(length=255), nullable=True)
    if GOOGLE_SUB_INDEX not in _indexes():
        op.create_index(GOOGLE_SUB_INDEX, "users", ["google_sub"], unique=True)


def downgrade() -> None:
    if GOOGLE_SUB_INDEX in _indexes():
        op.drop_index(GOOGLE_SUB_INDEX, table_name="users")
    columns = _columns()
    with op.batch_alter_table("users") as batch:
        for name in ("sessions_valid_after", "google_sub", "email_verified_at"):
            if name in columns:
                batch.drop_column(name)
        # hashed_password goes back to NOT NULL only if no account is password-less.
