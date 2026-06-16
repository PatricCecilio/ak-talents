from app.core.config import settings
from app.database.base import Base
from app.database.session import engine


def _ensure_development_database() -> None:
    database_url = settings.DATABASE_URL.lower()
    allowed_markers = ("localhost", "127.0.0.1", "sqlite")

    if not any(marker in database_url for marker in allowed_markers):
        raise RuntimeError(
            "Refusing to reset a non-local database. DATABASE_URL must point to localhost, 127.0.0.1, or sqlite."
        )


def reset_database() -> None:
    _ensure_development_database()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("AK Talent development database reset completed.")


if __name__ == "__main__":
    reset_database()
