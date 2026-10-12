"""Data for the new panel: note kinds, job publish/close dates, manual candidates, LGPD erasure log.

Additive only (nothing is deleted or rewritten except filling the new columns):
- application_notes.kind (default "anotacao"); the existing AK opinions ("parecer", finalist_summary) and the client
  answers recorded in the history ("Resposta do cliente: ...") become notes of kind "parecer" / "retorno_cliente",
  with the author and date of the original event;
- jobs.published_at (published jobs get their creation date) and jobs.closed_at;
- candidates.source, created_by_user_id, authorization_recorded_at and anonymized_at;
- new table data_deletion_log (who erased a candidate's data and when, never the data itself).

The API in production keeps working with the migrated database (it ignores the new columns).

Revision ID: 0015_panel_data
Revises: 0014_internal_companies
Create Date: 2026-10-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision: str = "0015_panel_data"
down_revision: Union[str, None] = "0014_internal_companies"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(table: str) -> set[str]:
    return {column["name"] for column in inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()

    if "kind" not in _columns("application_notes"):
        op.add_column(
            "application_notes",
            sa.Column("kind", sa.String(length=20), nullable=False, server_default="anotacao"),
        )
        # The opinion sent to the client, dated and signed by whoever moved the candidate to "finalist".
        op.execute(
            """
            INSERT INTO application_notes (application_id, author_user_id, kind, body, created_at)
            SELECT a.id,
                   (SELECT h.changed_by_user_id FROM application_stage_history h
                     WHERE h.application_id = a.id AND h.to_stage = 'finalist' ORDER BY h.created_at DESC, h.id DESC LIMIT 1),
                   'parecer',
                   a.finalist_summary,
                   COALESCE((SELECT h.created_at FROM application_stage_history h
                     WHERE h.application_id = a.id AND h.to_stage = 'finalist' ORDER BY h.created_at DESC, h.id DESC LIMIT 1),
                     a.stage_updated_at)
            FROM applications a
            WHERE a.finalist_summary IS NOT NULL AND TRIM(a.finalist_summary) <> ''
            """
        )
        # The client's answers recorded by AK in the history.
        op.execute(
            """
            INSERT INTO application_notes (application_id, author_user_id, kind, body, created_at)
            SELECT h.application_id, h.changed_by_user_id, 'retorno_cliente', h.note, h.created_at
            FROM application_stage_history h
            WHERE h.note LIKE 'Resposta do cliente:%'
            """
        )

    job_columns = _columns("jobs")
    if "published_at" not in job_columns:
        op.add_column("jobs", sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
        op.execute("UPDATE jobs SET published_at = created_at WHERE status IN ('approved', 'closed', 'archived')")
    if "closed_at" not in job_columns:
        op.add_column("jobs", sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True))

    candidate_columns = _columns("candidates")
    for name, column_type in (
        ("source", sa.String(length=30)),
        ("authorization_recorded_at", sa.DateTime(timezone=True)),
        ("anonymized_at", sa.DateTime(timezone=True)),
    ):
        if name not in candidate_columns:
            op.add_column("candidates", sa.Column(name, column_type, nullable=True))
    if "created_by_user_id" not in candidate_columns:
        with op.batch_alter_table("candidates") as batch:
            batch.add_column(sa.Column("created_by_user_id", sa.Integer(), nullable=True))
            batch.create_foreign_key(
                "fk_candidates_created_by_user_id", "users", ["created_by_user_id"], ["id"], ondelete="SET NULL"
            )
    if "source" not in candidate_columns:
        op.execute("UPDATE candidates SET source = CASE WHEN user_id IS NULL THEN 'site' ELSE 'conta' END")

    if "data_deletion_log" not in inspect(bind).get_table_names():
        op.create_table(
            "data_deletion_log",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("candidate_id", sa.Integer(), sa.ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True),
            sa.Column("performed_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("applications_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("files_deleted", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("performed_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_data_deletion_log_id", "data_deletion_log", ["id"])
        op.create_index("ix_data_deletion_log_candidate_id", "data_deletion_log", ["candidate_id"])


def downgrade() -> None:
    bind = op.get_bind()
    if "data_deletion_log" in inspect(bind).get_table_names():
        op.drop_table("data_deletion_log")
    candidate_columns = _columns("candidates")
    with op.batch_alter_table("candidates") as batch:
        if "created_by_user_id" in candidate_columns:
            batch.drop_constraint("fk_candidates_created_by_user_id", type_="foreignkey")
            batch.drop_column("created_by_user_id")
        for name in ("anonymized_at", "authorization_recorded_at", "source"):
            if name in candidate_columns:
                batch.drop_column(name)
    job_columns = _columns("jobs")
    with op.batch_alter_table("jobs") as batch:
        for name in ("closed_at", "published_at"):
            if name in job_columns:
                batch.drop_column(name)
    if "kind" in _columns("application_notes"):
        # Notes created from existing opinions/answers go; the opinions and the history stay where they were.
        op.execute("DELETE FROM application_notes WHERE kind IN ('parecer', 'retorno_cliente')")
        with op.batch_alter_table("application_notes") as batch:
            batch.drop_column("kind")
