"""Record privacy policy consent on accounts and applications.

Revision ID: 0007_privacy_consent
Revises: 0006_appintelli_ref
Create Date: 2026-10-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision: str = "0007_privacy_consent"
down_revision: Union[str, None] = "0006_appintelli_ref"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(table: str) -> set[str]:
    return {column["name"] for column in inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    # Nullable: accounts created before this migration have no recorded consent.
    user_columns = _columns("users")
    if "privacy_accepted_at" not in user_columns:
        op.add_column("users", sa.Column("privacy_accepted_at", sa.DateTime(timezone=True), nullable=True))
    if "privacy_policy_version" not in user_columns:
        op.add_column("users", sa.Column("privacy_policy_version", sa.String(length=20), nullable=True))

    if "privacy_policy_version" not in _columns("applications"):
        op.add_column("applications", sa.Column("privacy_policy_version", sa.String(length=20), nullable=True))


def downgrade() -> None:
    if "privacy_policy_version" in _columns("applications"):
        op.drop_column("applications", "privacy_policy_version")

    user_columns = _columns("users")
    if "privacy_policy_version" in user_columns:
        op.drop_column("users", "privacy_policy_version")
    if "privacy_accepted_at" in user_columns:
        op.drop_column("users", "privacy_accepted_at")
