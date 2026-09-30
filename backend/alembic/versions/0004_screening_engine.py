"""Add deterministic screening engine.

Revision ID: 0004_screening_engine
Revises: 0003_public_candidates
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_screening_engine"
down_revision: Union[str, None] = "0003_public_candidates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    application_columns = {column["name"] for column in inspector.get_columns("applications")}
    tables = set(inspector.get_table_names())

    if "screening_status" not in application_columns:
        op.add_column(
            "applications",
            sa.Column("screening_status", sa.String(length=50), nullable=False, server_default="pending_screening"),
        )
        op.alter_column("applications", "screening_status", server_default=None)

    if "screening_score" not in application_columns:
        op.add_column("applications", sa.Column("screening_score", sa.Integer(), nullable=True))

    if "screening_summary" not in application_columns:
        op.add_column("applications", sa.Column("screening_summary", sa.Text(), nullable=True))

    if "screening_questions" not in tables:
        op.create_table(
            "screening_questions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("job_id", sa.Integer(), nullable=False),
            sa.Column("key", sa.String(length=120), nullable=False),
            sa.Column("label", sa.String(length=500), nullable=False),
            sa.Column("question_type", sa.String(length=40), nullable=False),
            sa.Column("required", sa.Boolean(), nullable=False),
            sa.Column("options", sa.JSON(), nullable=True),
            sa.Column("rule", sa.JSON(), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_screening_questions_id", "screening_questions", ["id"], unique=False)
        op.create_index("ix_screening_questions_job_id", "screening_questions", ["job_id"], unique=False)

    if "screening_answers" not in tables:
        op.create_table(
            "screening_answers",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("application_id", sa.Integer(), nullable=False),
            sa.Column("question_id", sa.Integer(), nullable=False),
            sa.Column("value_bool", sa.Boolean(), nullable=True),
            sa.Column("value_text", sa.Text(), nullable=True),
            sa.Column("value_select", sa.String(length=180), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["question_id"], ["screening_questions.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("application_id", "question_id", name="uq_application_screening_answer"),
        )
        op.create_index("ix_screening_answers_id", "screening_answers", ["id"], unique=False)
        op.create_index("ix_screening_answers_application_id", "screening_answers", ["application_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_screening_answers_application_id", table_name="screening_answers")
    op.drop_index("ix_screening_answers_id", table_name="screening_answers")
    op.drop_table("screening_answers")
    op.drop_index("ix_screening_questions_job_id", table_name="screening_questions")
    op.drop_index("ix_screening_questions_id", table_name="screening_questions")
    op.drop_table("screening_questions")
    op.drop_column("applications", "screening_summary")
    op.drop_column("applications", "screening_score")
    op.drop_column("applications", "screening_status")
