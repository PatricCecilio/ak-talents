import unittest
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import auth, jobs
from app.core.privacy import PRIVACY_CONSENT_REQUIRED_MESSAGE, PRIVACY_POLICY_VERSION
from app.core.rate_limit import limiter
from app.database.base import Base
from app.database.session import get_db
from app.models.application import Application
from app.models.company import Company
from app.models.job import Job
from app.models.user import User


class PrivacyConsentTestCase(unittest.TestCase):
    def setUp(self) -> None:
        limiter.reset()
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        app.include_router(auth.router, prefix="/auth")
        app.include_router(jobs.router, prefix="/jobs")
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self) -> None:
        limiter.reset()

    def register(self, role: str, **extra):
        payload = {"name": "Pessoa Teste", "email": f"{role}@example.com", "password": "senha-forte-1", "role": role}
        payload.update(extra)
        return self.client.post("/auth/register", json=payload)

    def stored_user(self, email: str) -> User | None:
        with self.SessionLocal() as db:
            return db.query(User).filter(User.email == email).first()

    def test_register_without_consent_is_refused_and_creates_nothing(self) -> None:
        for extra in ({}, {"privacy_accepted": False}):
            response = self.register("candidate", **extra)
            self.assertEqual(response.status_code, 422)
            self.assertEqual(response.json()["detail"], PRIVACY_CONSENT_REQUIRED_MESSAGE)
        self.assertIsNone(self.stored_user("candidate@example.com"))

    def test_candidate_name_in_all_caps_is_saved_in_normal_case_company_name_is_kept(self) -> None:
        self.assertEqual(self.register("candidate", name="MARIA DA SILVA", privacy_accepted=True).status_code, 201)
        self.assertEqual(self.stored_user("candidate@example.com").name, "Maria da Silva")
        self.assertEqual(self.register("company", name="MERCADO BOM PREÇO", privacy_accepted=True).status_code, 201)
        self.assertEqual(self.stored_user("company@example.com").name, "MERCADO BOM PREÇO")

    def test_candidate_and_company_consent_is_recorded_with_time_and_version(self) -> None:
        for role in ("candidate", "company"):
            response = self.register(role, privacy_accepted=True, company_name="Empresa X" if role == "company" else None)
            self.assertEqual(response.status_code, 201, response.text)

            user = self.stored_user(f"{role}@example.com")
            self.assertIsNotNone(user.privacy_accepted_at)
            recorded_at = user.privacy_accepted_at.replace(tzinfo=None)  # SQLite returns naive UTC
            self.assertLess(abs((datetime.now(timezone.utc).replace(tzinfo=None) - recorded_at).total_seconds()), 60)
            self.assertEqual(user.privacy_policy_version, PRIVACY_POLICY_VERSION)

    def test_public_application_records_policy_version(self) -> None:
        with self.SessionLocal() as db:
            owner = User(name="Empresa", email="dona@example.com", hashed_password="x", role="company")
            db.add(owner)
            db.flush()
            company = Company(user_id=owner.id, company_name="Empresa", status="approved")
            db.add(company)
            db.flush()
            db.add(Job(company_id=company.id, title="Atendente", slug="atendente", description="Atendimento ao cliente.", status="approved", is_active=True))
            db.commit()

        response = self.client.post(
            "/jobs/atendente/applications",
            json={
                "full_name": "Maria Souza",
                "email": "maria@example.com",
                "phone": "(41) 99999-0000",
                "city": "Curitiba",
                "neighborhood": "Centro",
                "privacy_accepted": True,
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        with self.SessionLocal() as db:
            application = db.query(Application).one()
            self.assertIsNotNone(application.privacy_accepted_at)
            self.assertEqual(application.privacy_policy_version, PRIVACY_POLICY_VERSION)

    def test_public_application_without_consent_has_portuguese_message(self) -> None:
        response = self.client.post(
            "/jobs/qualquer/applications",
            json={
                "full_name": "Maria Souza",
                "email": "maria@example.com",
                "phone": "(41) 99999-0000",
                "city": "Curitiba",
                "neighborhood": "Centro",
                "privacy_accepted": False,
            },
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"], PRIVACY_CONSENT_REQUIRED_MESSAGE)


if __name__ == "__main__":
    unittest.main()
