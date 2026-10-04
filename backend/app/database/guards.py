from app.core import config as app_config
from app.core.config import Settings

LOCAL_DATABASE_MARKERS = ("localhost", "127.0.0.1", "sqlite")


def ensure_local_database(config: Settings | None = None) -> None:
    """Refuse destructive/dev-only database commands (reset, seed) outside a local environment."""
    config = config or app_config.settings
    if config.ENVIRONMENT == "production":
        raise RuntimeError("Recusado: este comando não pode rodar com ENVIRONMENT=production.")

    database_url = config.DATABASE_URL.lower()
    if not any(marker in database_url for marker in LOCAL_DATABASE_MARKERS):
        raise RuntimeError(
            "Recusado: DATABASE_URL precisa apontar para um banco local (localhost, 127.0.0.1 ou sqlite)."
        )
