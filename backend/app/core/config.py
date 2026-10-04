import os
from functools import cached_property
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_JWT_SECRET_KEY = "change-this-secret-in-production"
MIN_JWT_SECRET_LENGTH = 32


class Settings(BaseSettings):
    ENVIRONMENT: Literal["development", "test", "production"] = "development"
    PROJECT_NAME: str = "AK Talent API"
    API_V1_PREFIX: str = ""
    DATABASE_URL: str = "postgresql+psycopg2://aktalent:aktalent@localhost:5432/aktalent"
    JWT_SECRET_KEY: str = DEFAULT_JWT_SECRET_KEY
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    AUTO_CREATE_TABLES_ON_STARTUP: bool = True
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-5.5"
    APPINTELLI_INTEGRATION_SECRET: str = ""
    RATE_LIMIT_ENABLED: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @model_validator(mode="after")
    def _require_strong_jwt_secret_in_production(self) -> "Settings":
        # Refuse to boot production with a missing, short or default signing key: every token
        # would be forgeable. Development and tests keep the convenient default.
        if self.ENVIRONMENT == "production":
            secret = self.JWT_SECRET_KEY.strip()
            if not secret or secret == DEFAULT_JWT_SECRET_KEY or len(secret) < MIN_JWT_SECRET_LENGTH:
                raise ValueError(
                    "JWT_SECRET_KEY inválido para produção: defina um segredo aleatório com pelo menos "
                    f"{MIN_JWT_SECRET_LENGTH} caracteres (ex.: python -c \"import secrets; "
                    "print(secrets.token_urlsafe(48))\")."
                )
        return self

    @cached_property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]

    @cached_property
    def should_create_tables_on_startup(self) -> bool:
        return self.ENVIRONMENT != "production" and self.AUTO_CREATE_TABLES_ON_STARTUP


settings = Settings(_env_file=os.environ.get("AKTALENT_ENV_FILE", ".env") or None)
