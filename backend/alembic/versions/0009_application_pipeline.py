"""Application pipeline: stage, stage history and internal notes.

Existing applications start in "screening" when the automated screening already finished, otherwise
in "new", each with an initial history entry recorded by the system.

Revision ID: 0009_application_pipeline
Revises: 0008_job_recruiter
Create Date: 2026-10-04
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision: str = "0009_application_pipeline"
down_revision: Union[str, None] = "0008_job_recruiter"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(table: str) -> set[str]:
    return {column["name"] for column in inspect(op.get_bind()).get_columns(table)}


def _tables() -> set[str]:
    return set(inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    application_columns = _columns("applications")
    adding_stage = "stage" not in application_columns

    if adding_stage:
        op.add_column("applications", sa.Column("stage", sa.String(length=30), nullable=False, server_default="new"))
        op.create_index("ix_applications_stage", "applications", ["stage"])
    if "stage_updated_at" not in application_columns:
        op.add_column("applications", sa.Column("stage_updated_at", sa.DateTime(timezone=True), nullable=True))
    if "finalist_summary" not in application_columns:
        op.add_column("applications", sa.Column("finalist_summary", sa.Text(), nullable=True))
    if "is_hidden" not in application_columns:
        op.add_column("applications", sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()))

    tables = _tables()
    if "application_stage_history" not in tables:
        op.create_table(
            "application_stage_history",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
            sa.Column("from_stage", sa.String(length=30), nullable=True),
            sa.Column("to_stage", sa.String(length=30), nullable=False),
            sa.Column("changed_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("changed_by_role", sa.String(length=30), nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_application_stage_history_id", "application_stage_history", ["id"])
        op.create_index("ix_application_stage_history_application_id", "application_stage_history", ["application_id"])
    if "application_notes" not in tables:
        op.create_table(
            "application_notes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
            sa.Column("author_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_application_notes_id", "application_notes", ["id"])
        op.create_index("ix_application_notes_application_id", "application_notes", ["application_id"])

    if adding_stage:
        op.execute(
            "UPDATE applications SET "
            "stage = CASE WHEN screening_completed_at IS NOT NULL THEN 'screening' ELSE 'new' END, "
            "stage_updated_at = COALESCE(screening_completed_at, created_at)"
        )
        op.execute(
            "INSERT INTO application_stage_history "
            "(application_id, from_stage, to_stage, changed_by_user_id, changed_by_role, note, created_at) "
            "SELECT id, NULL, stage, NULL, 'system', 'Etapa inicial definida na migração.', stage_updated_at "
            "FROM applications"
        )
    op.execute("UPDATE applications SET stage_updated_at = created_at WHERE stage_updated_at IS NULL")


def downgrade() -> None:
    tables = _tables()
    if "application_notes" in tables:
        op.drop_table("application_notes")
    if "application_stage_history" in tables:
        op.drop_table("application_stage_history")

    application_columns = _columns("applications")
    with op.batch_alter_table("applications") as batch:
        if "stage" in application_columns:
            batch.drop_index("ix_applications_stage")
            batch.drop_column("stage")
        for column in ("stage_updated_at", "finalist_summary", "is_hidden"):
            if column in application_columns:
                batch.drop_column(column)
