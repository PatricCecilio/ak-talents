from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "AK Talent API"
    API_V1_PREFIX: str = ""
    DATABASE_URL: str = "postgresql+psycopg2://aktalent:aktalent@localhost:5432/aktalent"
    JWT_SECRET_KEY: str = "change-this-secret-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-5.5"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @cached_property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
