"""Add AppIntelli integration reference.

Revision ID: 0006_appintelli_ref
Revises: 0005_screening_public_access
Create Date: 2026-09-30
"""

from typing import Sequence, Union

import secrets
import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision: str = "0006_appintelli_ref"
down_revision: Union[str, None] = "0005_screening_public_access"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _new_reference() -> str:
    return secrets.token_urlsafe(32)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    application_columns = {column["name"] for column in inspector.get_columns("applications")}
    application_indexes = {index["name"] for index in inspector.get_indexes("applications")}

    if "appintelli_reference" not in application_columns:
        op.add_column("applications", sa.Column("appintelli_reference", sa.String(length=64), nullable=True))

    applications = sa.table(
        "applications",
        sa.column("id", sa.Integer),
        sa.column("appintelli_reference", sa.String),
    )
    rows = bind.execute(
        sa.select(applications.c.id).where(applications.c.appintelli_reference.is_(None))
    ).fetchall()
    used_references = {
        row[0]
        for row in bind.execute(
            sa.select(applications.c.appintelli_reference).where(applications.c.appintelli_reference.is_not(None))
        ).fetchall()
    }

    for row in rows:
        reference = _new_reference()
        while reference in used_references:
            reference = _new_reference()
        used_references.add(reference)
        bind.execute(
            applications.update()
            .where(applications.c.id == row.id)
            .values(appintelli_reference=reference)
        )

    if "ix_applications_appintelli_reference" not in application_indexes:
        op.create_index(
            "ix_applications_appintelli_reference",
            "applications",
            ["appintelli_reference"],
            unique=True,
        )

    op.alter_column("applications", "appintelli_reference", nullable=False)


def downgrade() -> None:
    op.drop_index("ix_applications_appintelli_reference", table_name="applications")
    op.drop_column("applications", "appintelli_reference")
