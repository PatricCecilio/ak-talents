"""Support public candidates and applications.

Revision ID: 0003_public_candidates
Revises: 0002_add_job_slug
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_public_candidates"
down_revision: Union[str, None] = "0002_add_job_slug"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    candidate_columns = {column["name"] for column in inspector.get_columns("candidates")}
    application_columns = {column["name"] for column in inspector.get_columns("applications")}
    candidate_indexes = {index["name"] for index in inspector.get_indexes("candidates")}

    if "email" not in candidate_columns:
        op.add_column("candidates", sa.Column("email", sa.String(length=255), nullable=True))

    if "neighborhood" not in candidate_columns:
        op.add_column("candidates", sa.Column("neighborhood", sa.String(length=180), nullable=True))

    bind.execute(
        sa.text(
            "UPDATE candidates SET email = users.email "
            "FROM users WHERE candidates.user_id = users.id AND candidates.email IS NULL"
        )
    )

    op.alter_column("candidates", "user_id", existing_type=sa.Integer(), nullable=True)

    if "ix_candidates_email" not in candidate_indexes:
        op.create_index("ix_candidates_email", "candidates", ["email"], unique=False)

    if "privacy_accepted_at" not in application_columns:
        op.add_column("applications", sa.Column("privacy_accepted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("applications", "privacy_accepted_at")
    op.drop_index("ix_candidates_email", table_name="candidates")
    op.alter_column("candidates", "user_id", existing_type=sa.Integer(), nullable=False)
    op.drop_column("candidates", "neighborhood")
    op.drop_column("candidates", "email")
