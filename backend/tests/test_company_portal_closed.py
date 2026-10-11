import unittest
from unittest import mock
from urllib.parse import parse_qs, urlparse

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import auth, companies, jobs
from app.core import messages
from app.core.config import settings
from app.core.errors import install_error_handlers
from app.core.rate_limit import limiter
from app.core.security import create_access_token, get_password_hash
from app.database.base import Base
from app.database.session import get_db
from app.models.company import Company
from app.models.user import User
from tests.test_google_auth import CERT_PEM, CLIENT_ID, KID, google_token

SITE = "https://www.aktalent.com.br"
CSRF = "csrf-valor-de-teste-123"
PASSWORD = "senha-forte-1"


class CompanyPortalClosedTestCase(unittest.TestCase):
    """COMPANY_PORTAL_ENABLED=false (production): AK operates everything; company accounts are kept but locked out."""

    def setUp(self) -> None:
        limiter.reset()
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

        with self.SessionLocal() as db:
            company_user = User(name="Empresa", email="rh@empresa.com", hashed_password=get_password_hash(PASSWORD), role="company", is_active=True)
            db.add(company_user)
            db.flush()
            db.add(Company(user_id=company_user.id, company_name="Empresa Antiga", status="approved"))
            db.commit()
            self.company_user_id = company_user.id

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        install_error_handlers(app)
        for module, prefix in ((auth, "/auth"), (companies, "/companies"), (jobs, "/jobs")):
            app.include_router(module.router, prefix=prefix)
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)
        for patcher in (
            mock.patch.object(settings, "COMPANY_PORTAL_ENABLED", False),
            mock.patch("google.oauth2.id_token._fetch_certs", return_value={KID: CERT_PEM}),
            mock.patch.object(settings, "GOOGLE_CLIENT_ID", CLIENT_ID),
            mock.patch.object(settings, "FRONTEND_URL", SITE),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def tearDown(self) -> None:
        limiter.reset()

    def users(self) -> int:
        with self.SessionLocal() as db:
            return db.query(User).count()

    def test_the_portal_is_off_by_default(self) -> None:
        self.assertFalse(type(settings).model_fields["COMPANY_PORTAL_ENABLED"].default)

    def test_company_sign_up_is_closed(self) -> None:
        response = self.client.post(
            "/auth/register",
            json={"name": "Nova Empresa", "email": "nova@empresa.com", "password": PASSWORD, "role": "company", "company_name": "Nova", "privacy_accepted": True},
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], messages.COMPANY_SIGNUP_CLOSED)
        self.assertEqual(self.users(), 1)
        # Candidates still sign up normally.
        candidate = self.client.post(
            "/auth/register",
            json={"name": "Ana", "email": "ana@example.com", "password": PASSWORD, "role": "candidate", "privacy_accepted": True},
        )
        self.assertEqual(candidate.status_code, 201, candidate.text)

    def test_existing_company_account_gets_a_friendly_refusal_only_with_the_right_password(self) -> None:
        wrong = self.client.post("/auth/login", json={"email": "rh@empresa.com", "password": "outra-senha-1"})
        self.assertEqual(wrong.status_code, 401)
        self.assertEqual(wrong.json()["detail"], messages.INVALID_CREDENTIALS)

        right = self.client.post("/auth/login", json={"email": "rh@empresa.com", "password": PASSWORD})
        self.assertEqual(right.status_code, 403)
        self.assertEqual(right.json()["detail"], messages.COMPANY_PORTAL_CLOSED)
        self.assertNotIn("access_token", right.json())

    def test_sessions_opened_before_closing_stop_working(self) -> None:
        headers = {"Authorization": f"Bearer {create_access_token(self.company_user_id)}"}
        for method, path in (("GET", "/companies/me"), ("GET", "/companies/me/finalists"), ("GET", "/companies/me/jobs")):
            with self.subTest(path=path):
                response = self.client.request(method, path, headers=headers)
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.json()["detail"], messages.COMPANY_PORTAL_CLOSED)
        job = self.client.post("/jobs", headers=headers, json={"title": "Vaga nova", "description": "Descrição da vaga."})
        self.assertEqual(job.status_code, 403)

    def test_google_company_door_is_closed_and_creates_nothing(self) -> None:
        token = google_token(sub="sub-nova-empresa", email="dona@gmail.com", name="Dona")
        response = self.client.post("/auth/google", json={"credential": token, "door": "empresa", "privacy_accepted": True})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], messages.COMPANY_PORTAL_CLOSED)
        self.assertEqual(self.users(), 1)

        # Redirect mode: back to the chooser (/entrar) with erro=empresa.
        self.client.cookies.set("g_csrf_token", CSRF)
        redirect = self.client.post(
            "/auth/google/redirect/empresa", data={"credential": token, "g_csrf_token": CSRF}, follow_redirects=False
        )
        self.assertEqual(redirect.status_code, 303)
        location = urlparse(redirect.headers["location"])
        self.assertEqual(location.path, "/entrar")
        self.assertEqual(parse_qs(location.query), {"erro": ["empresa"]})
        self.assertEqual(self.users(), 1)

    def test_google_never_lets_a_company_account_in_through_the_candidate_door(self) -> None:
        token = google_token(sub="sub-rh", email="rh@empresa.com", name="RH")
        response = self.client.post("/auth/google", json={"credential": token, "door": "candidato", "privacy_accepted": True})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], messages.COMPANY_PORTAL_CLOSED)
        with self.SessionLocal() as db:
            user = db.get(User, self.company_user_id)
            # Not linked: the password still exists and no Google id was stored.
            self.assertIsNone(user.google_sub)
            self.assertIsNotNone(user.hashed_password)

    def test_candidate_google_sign_in_still_works(self) -> None:
        token = google_token(sub="sub-ana", email="ana@gmail.com", name="Ana")
        response = self.client.post("/auth/google", json={"credential": token, "door": "candidato", "privacy_accepted": True})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["user"]["role"], "candidate")


if __name__ == "__main__":
    unittest.main()
