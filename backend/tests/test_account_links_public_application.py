import unittest
from unittest import mock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import auth, candidates, jobs
from app.core.config import settings
from app.core.rate_limit import limiter
from app.database.base import Base
from app.database.session import get_db
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.user import User


class PublicFormVersusAccountsTestCase(unittest.TestCase):
    """Without e-mail verification, typing someone's e-mail in the public form must not touch their account."""

    def setUp(self) -> None:
        limiter.reset()
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
        with self.SessionLocal() as db:
            owner = User(name="Empresa", email="empresa@example.com", hashed_password="x", role="company", is_active=True)
            db.add(owner)
            db.flush()
            company = Company(user_id=owner.id, company_name="Empresa", status="approved")
            db.add(company)
            db.flush()
            db.add(Job(company_id=company.id, title="Atendente", slug="atendente", description="Atendimento.", status="approved", is_active=True))
            db.commit()

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        for module, prefix in ((auth, "/auth"), (candidates, "/candidates"), (jobs, "/jobs")):
            app.include_router(module.router, prefix=prefix)
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

        # An existing account whose profile already has phone and city filled in.
        register = self.client.post(
            "/auth/register",
            json={"name": "Júlia Lima", "email": "julia@example.com", "password": "senha-forte-1", "role": "candidate", "privacy_accepted": True},
        )
        self.token = register.json()["access_token"]
        profile = self.client.put(
            "/candidates/me",
            json={"phone": "41911112222", "city": "Curitiba"},
            headers={"Authorization": f"Bearer {self.token}"},
        )
        self.assertEqual(profile.status_code, 200, profile.text)

    def tearDown(self) -> None:
        limiter.reset()

    def account_profile(self) -> Candidate:
        with self.SessionLocal() as db:
            return db.query(Candidate).join(User, Candidate.user_id == User.id).filter(User.email == "julia@example.com").one()

    def my_applications(self) -> list:
        response = self.client.get("/candidates/me/applications", headers={"Authorization": f"Bearer {self.token}"})
        return response.json()["applications"]

    def apply(self, **overrides):
        payload = {
            "full_name": "Outra Pessoa",
            "email": "julia@example.com",
            "phone": "41999998888",
            "city": "Pinhais",
            "neighborhood": "Centro",
            "privacy_accepted": True,
        }
        payload.update(overrides)
        return self.client.post("/jobs/atendente/applications", json=payload)

    # --- default: linking by e-mail is OFF ---

    def test_flag_is_off_by_default(self) -> None:
        self.assertFalse(settings.LINK_PUBLIC_APPLICATIONS_BY_EMAIL)

    def test_form_with_another_accounts_email_does_not_change_the_account(self) -> None:
        before = self.account_profile()
        response = self.apply()
        self.assertEqual(response.status_code, 201, response.text)

        after = self.account_profile()
        self.assertEqual(
            (after.full_name, after.phone, after.city, after.neighborhood),
            (before.full_name, "41911112222", "Curitiba", before.neighborhood),
        )

    def test_application_with_account_email_does_not_show_in_that_account(self) -> None:
        self.assertEqual(self.apply().status_code, 201)
        self.assertEqual(self.my_applications(), [])

        with self.SessionLocal() as db:
            application = db.query(Application).one()
            self.assertIsNone(application.candidate.user_id)  # kept as a separate, account-less applicant
            self.assertEqual(db.query(Candidate).count(), 2)

    def test_using_the_accounts_phone_does_not_link_either(self) -> None:
        response = self.apply(email="outra@example.com", phone="41911112222")
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(self.my_applications(), [])
        self.assertEqual(self.account_profile().city, "Curitiba")

    def test_empty_account_fields_are_not_filled_while_the_flag_is_off(self) -> None:
        with self.SessionLocal() as db:
            db.query(Candidate).filter(Candidate.user_id.isnot(None)).update({"phone": None, "city": None})
            db.commit()
        self.assertEqual(self.apply().status_code, 201)
        profile = self.account_profile()
        self.assertIsNone(profile.phone)
        self.assertIsNone(profile.city)

    # --- future: flag ON (only once e-mail verification exists) ---

    def test_flag_on_links_and_only_fills_empty_fields(self) -> None:
        with self.SessionLocal() as db:
            db.query(Candidate).filter(Candidate.user_id.isnot(None)).update({"neighborhood": None})
            db.commit()

        with mock.patch.object(settings, "LINK_PUBLIC_APPLICATIONS_BY_EMAIL", True):
            response = self.apply(phone="41911112222", city="Pinhais", neighborhood="Batel", full_name="Outro Nome")
        self.assertEqual(response.status_code, 201, response.text)

        profile = self.account_profile()
        self.assertEqual(profile.full_name, "Júlia Lima")  # never overwritten
        self.assertEqual(profile.city, "Curitiba")  # never overwritten
        self.assertEqual(profile.phone, "41911112222")
        self.assertEqual(profile.neighborhood, "Batel")  # was empty: filled
        self.assertEqual([item["job_title"] for item in self.my_applications()], ["Atendente"])

    def test_flag_on_still_refuses_a_different_phone_for_the_account(self) -> None:
        with mock.patch.object(settings, "LINK_PUBLIC_APPLICATIONS_BY_EMAIL", True):
            response = self.apply(phone="41999998888")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.account_profile().phone, "41911112222")
        self.assertEqual(self.my_applications(), [])


if __name__ == "__main__":
    unittest.main()
