"""Harden public screening access.

Revision ID: 0005_screening_public_access
Revises: 0004_screening_engine
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_screening_public_access"
down_revision: Union[str, None] = "0004_screening_engine"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    application_columns = {column["name"] for column in inspector.get_columns("applications")}
    application_indexes = {index["name"] for index in inspector.get_indexes("applications")}

    if "public_screening_token_hash" not in application_columns:
        op.add_column("applications", sa.Column("public_screening_token_hash", sa.String(length=64), nullable=True))

    if "screening_completed_at" not in application_columns:
        op.add_column("applications", sa.Column("screening_completed_at", sa.DateTime(timezone=True), nullable=True))

    if "ix_applications_public_screening_token_hash" not in application_indexes:
        op.create_index(
            "ix_applications_public_screening_token_hash",
            "applications",
            ["public_screening_token_hash"],
            unique=True,
        )


def downgrade() -> None:
    op.drop_index("ix_applications_public_screening_token_hash", table_name="applications")
    op.drop_column("applications", "screening_completed_at")
    op.drop_column("applications", "public_screening_token_hash")
