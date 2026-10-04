import os
from collections.abc import Mapping
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def engine_options(env: Mapping[str, str] = os.environ) -> dict[str, Any]:
    """On Vercel (serverless) keep no connection pool in the function: Neon's PgBouncer does the pooling,
    and connections parked in a frozen function instance go stale. Elsewhere use SQLAlchemy's pool."""
    if env.get("VERCEL"):
        return {"poolclass": NullPool}
    return {"pool_pre_ping": True}


engine = create_engine(settings.DATABASE_URL, **engine_options())
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
