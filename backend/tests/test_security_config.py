import unittest
from unittest import mock

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from openai import OpenAIError
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.api.routes import jobs
from app.core import config as app_config
from app.core.config import DEFAULT_JWT_SECRET_KEY, Settings
from app.core.security import create_access_token
from app.database import seed
from app.database.base import Base
from app.database.guards import ensure_local_database
from app.database.session import get_db
from app.models.company import Company
from app.models.user import User
from app.schemas.ai import CandidateProfileAIRequest
from app.schemas.job import JobCreate
from app.services import ai_service

STRONG_SECRET = "s" * 48


def make_settings(**overrides) -> Settings:
    values = {"ENVIRONMENT": "development", "DATABASE_URL": "sqlite://", "JWT_SECRET_KEY": STRONG_SECRET}
    values.update(overrides)
    return Settings(_env_file=None, **values)


class ProductionJwtSecretTestCase(unittest.TestCase):
    def test_production_refuses_missing_secret(self) -> None:
        with self.assertRaises(ValidationError):
            make_settings(ENVIRONMENT="production", JWT_SECRET_KEY="")

    def test_production_refuses_default_secret(self) -> None:
        with self.assertRaises(ValidationError):
            make_settings(ENVIRONMENT="production", JWT_SECRET_KEY=DEFAULT_JWT_SECRET_KEY)

    def test_production_refuses_short_secret(self) -> None:
        with self.assertRaises(ValidationError):
            make_settings(ENVIRONMENT="production", JWT_SECRET_KEY="x" * 31)

    def test_production_accepts_strong_secret(self) -> None:
        self.assertEqual(make_settings(ENVIRONMENT="production").ENVIRONMENT, "production")

    def test_development_keeps_default_secret(self) -> None:
        self.assertEqual(make_settings(JWT_SECRET_KEY=DEFAULT_JWT_SECRET_KEY).JWT_SECRET_KEY, DEFAULT_JWT_SECRET_KEY)


class DatabaseUrlTestCase(unittest.TestCase):
    def test_postgres_scheme_is_normalized_for_sqlalchemy(self) -> None:
        config = make_settings(DATABASE_URL=" postgres://user:pass@host:5432/ak ")
        self.assertEqual(config.DATABASE_URL, "postgresql://user:pass@host:5432/ak")

    def test_other_urls_are_kept(self) -> None:
        url = "postgresql+psycopg2://user:pass@localhost:5432/ak"
        self.assertEqual(make_settings(DATABASE_URL=url).DATABASE_URL, url)


class LocalDatabaseGuardTestCase(unittest.TestCase):
    def test_refuses_production_environment(self) -> None:
        with self.assertRaises(RuntimeError):
            ensure_local_database(make_settings(ENVIRONMENT="production"))

    def test_refuses_remote_database(self) -> None:
        with self.assertRaises(RuntimeError):
            ensure_local_database(make_settings(DATABASE_URL="postgresql://user:pass@db.example.com:5432/ak"))

    def test_accepts_local_database(self) -> None:
        ensure_local_database(make_settings(DATABASE_URL="postgresql://aktalent:aktalent@localhost:5432/aktalent"))

    def test_seed_refuses_remote_database_before_touching_it(self) -> None:
        remote = make_settings(DATABASE_URL="postgresql://user:pass@db.example.com:5432/ak")
        with mock.patch.object(app_config, "settings", remote), mock.patch.object(
            seed.Base.metadata, "create_all"
        ) as create_all:
            with self.assertRaises(RuntimeError):
                seed.run_seed()
        create_all.assert_not_called()


class InactiveUserTestCase(unittest.TestCase):
    def setUp(self) -> None:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

    def _create_user(self, is_active: bool) -> User:
        with self.SessionLocal() as db:
            user = User(name="Pessoa", email=f"p{is_active}@example.com", hashed_password="x", role="candidate", is_active=is_active)
            db.add(user)
            db.commit()
            return user

    def test_active_user_is_accepted(self) -> None:
        user = self._create_user(is_active=True)
        with self.SessionLocal() as db:
            self.assertEqual(get_current_user(create_access_token(user.id), db).id, user.id)

    def test_inactive_user_is_refused_even_with_valid_token(self) -> None:
        user = self._create_user(is_active=False)
        with self.SessionLocal() as db:
            with self.assertRaises(HTTPException) as ctx:
                get_current_user(create_access_token(user.id), db)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertEqual(ctx.exception.detail, "Usuário inativo.")


class OpenAIErrorHandlingTestCase(unittest.TestCase):
    payload = CandidateProfileAIRequest(
        desired_role="Analista", experience="2 anos", skills="Excel", city="Curitiba", work_mode="remote", salary_expectation="3000"
    )
    candidate = User(id=1, name="Pessoa", email="p@example.com", hashed_password="x", role="candidate", is_active=True)

    def test_provider_error_is_logged_and_not_exposed(self) -> None:
        client = mock.Mock()
        client.chat.completions.parse.side_effect = OpenAIError("invalid api key sk-SECRET-123 for org-xyz")
        with mock.patch.object(ai_service, "_get_client", return_value=client), self.assertLogs(ai_service.logger, "ERROR") as logs:
            with self.assertRaises(HTTPException) as ctx:
                ai_service.generate_candidate_profile(self.candidate, self.payload)

        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(ctx.exception.detail, ai_service.AI_FAILED_MESSAGE)
        self.assertNotIn("sk-SECRET", ctx.exception.detail)
        self.assertIn("sk-SECRET-123", "\n".join(logs.output))

    def test_missing_api_key_returns_generic_message(self) -> None:
        with mock.patch.object(ai_service.settings, "OPENAI_API_KEY", ""), self.assertLogs(ai_service.logger, "ERROR"):
            with self.assertRaises(HTTPException) as ctx:
                ai_service.generate_candidate_profile(self.candidate, self.payload)

        self.assertEqual(ctx.exception.status_code, 503)
        self.assertNotIn("OPENAI_API_KEY", ctx.exception.detail)


class SalaryRangeTestCase(unittest.TestCase):
    base = {"title": "Analista de RH", "description": "Descrição completa da vaga."}

    def test_min_greater_than_max_is_rejected(self) -> None:
        with self.assertRaises(ValidationError) as ctx:
            JobCreate(**self.base, salary_min=5000, salary_max=3000)
        self.assertIn("O salário mínimo não pode ser maior que o salário máximo.", str(ctx.exception))

    def test_ordered_equal_or_partial_ranges_are_accepted(self) -> None:
        JobCreate(**self.base, salary_min=3000, salary_max=5000)
        JobCreate(**self.base, salary_min=3000, salary_max=3000)
        JobCreate(**self.base, salary_min=3000)
        JobCreate(**self.base, salary_max=5000)

    def test_create_job_endpoint_rejects_inverted_range(self) -> None:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
        with SessionLocal() as db:
            user = User(name="Empresa", email="empresa@example.com", hashed_password="x", role="company", is_active=True)
            db.add(user)
            db.flush()
            db.add(Company(user_id=user.id, company_name="Empresa", status="approved"))
            db.commit()

        def override_get_db():
            with SessionLocal() as db:
                yield db

        app = FastAPI()
        app.include_router(jobs.router, prefix="/jobs")
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: user
        response = TestClient(app).post("/jobs", json={**self.base, "salary_min": 5000, "salary_max": 3000})

        self.assertEqual(response.status_code, 422)
        self.assertIn("O salário mínimo não pode ser maior que o salário máximo.", response.text)


if __name__ == "__main__":
    unittest.main()
