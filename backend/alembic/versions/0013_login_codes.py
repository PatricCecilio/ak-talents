"""One-time codes for the Google sign-in redirect flow.

Additive only: a new table. The API in production does not use it, so it keeps working with the migrated database.

Revision ID: 0013_login_codes
Revises: 0012_google_sign_in
Create Date: 2026-10-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision: str = "0013_login_codes"
down_revision: Union[str, None] = "0012_google_sign_in"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if "login_codes" in inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "login_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("purpose", sa.String(length=20), nullable=False),
        sa.Column("door", sa.String(length=20), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("google_sub", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=150), nullable=True),
        sa.Column("created_account", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("linked_account", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("linked_applications", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_login_codes_code_hash", "login_codes", ["code_hash"], unique=True)


def downgrade() -> None:
    if "login_codes" in inspect(op.get_bind()).get_table_names():
        op.drop_index("ix_login_codes_code_hash", table_name="login_codes")
        op.drop_table("login_codes")
