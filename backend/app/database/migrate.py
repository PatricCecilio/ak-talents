"""Bring the database schema up to date. Safe to run repeatedly; in production run it from your machine
against the database (see DEPLOY.md), never on function startup.

- Empty database: create every table from the models and stamp Alembic at head. Migration 0001 is
  only a baseline marker for databases that were created with create_all, so `alembic upgrade head`
  alone cannot build a fresh database.
- Existing database: `alembic upgrade head` (later migrations only add what is missing).

Usage, from backend/:  python -m app.database.migrate
"""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.core import config as app_config
from app.database.base import Base

BACKEND_DIR = Path(__file__).resolve().parents[2]
APP_TABLES = {"users", "companies", "candidates", "jobs", "applications"}


def _alembic_config() -> Config:
    alembic_config = Config(str(BACKEND_DIR / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return alembic_config


def migrate() -> str:
    """Returns "created" for a fresh database or "upgraded" for an existing one."""
    engine = create_engine(app_config.settings.DATABASE_URL, pool_pre_ping=True)
    try:
        existing_tables = set(inspect(engine).get_table_names())
        alembic_config = _alembic_config()

        if not existing_tables & APP_TABLES:
            Base.metadata.create_all(bind=engine)
            command.stamp(alembic_config, "head")
            return "created"

        command.upgrade(alembic_config, "head")
        return "upgraded"
    finally:
        engine.dispose()


if __name__ == "__main__":
    result = migrate()
    print("Banco criado do zero e marcado na versão mais recente." if result == "created" else "Banco atualizado (alembic upgrade head).")
