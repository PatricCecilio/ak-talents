import re
import unicodedata

from sqlalchemy.orm import Session

from app.models.job import Job


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value).strip("-").lower()
    return slug or "vaga"


def generate_unique_job_slug(db: Session, title: str) -> str:
    base_slug = slugify(title)
    existing_slugs = {
        slug
        for (slug,) in db.query(Job.slug)
        .filter(Job.slug.like(f"{base_slug}%"))
        .all()
        if slug
    }

    if base_slug not in existing_slugs:
        return base_slug

    suffix = 2
    while f"{base_slug}-{suffix}" in existing_slugs:
        suffix += 1

    return f"{base_slug}-{suffix}"
