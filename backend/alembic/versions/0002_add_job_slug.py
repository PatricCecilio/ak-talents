"""Add public slug to jobs.

Revision ID: 0002_add_job_slug
Revises: 0001_baseline_existing_schema
"""

from typing import Sequence, Union
import re
import unicodedata

from alembic import op
import sqlalchemy as sa

revision: str = "0002_add_job_slug"
down_revision: Union[str, None] = "0001_baseline_existing_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value).strip("-").lower()
    return slug or "vaga"


def _unique_slug(base_slug: str, used_slugs: set[str]) -> str:
    if base_slug not in used_slugs:
        return base_slug

    suffix = 2
    while f"{base_slug}-{suffix}" in used_slugs:
        suffix += 1

    return f"{base_slug}-{suffix}"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("jobs")}
    indexes = {index["name"] for index in inspector.get_indexes("jobs")}

    if "slug" not in columns:
        op.add_column("jobs", sa.Column("slug", sa.String(length=220), nullable=True))

    jobs = bind.execute(sa.text("SELECT id, title FROM jobs ORDER BY id")).mappings().all()
    used_slugs: set[str] = set()

    for job in jobs:
        slug = _unique_slug(_slugify(job["title"]), used_slugs)
        used_slugs.add(slug)
        bind.execute(
            sa.text("UPDATE jobs SET slug = :slug WHERE id = :job_id"),
            {"slug": slug, "job_id": job["id"]},
        )

    op.alter_column("jobs", "slug", existing_type=sa.String(length=220), nullable=False)
    if "ix_jobs_slug" not in indexes:
        op.create_index("ix_jobs_slug", "jobs", ["slug"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_jobs_slug", table_name="jobs")
    op.drop_column("jobs", "slug")
