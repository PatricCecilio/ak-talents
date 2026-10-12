import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import candidates
from app.core import messages
from app.core.errors import install_error_handlers
from app.core.security import create_access_token
from app.database.base import Base
from app.database.session import get_db
from app.models.candidate import Candidate
from app.models.user import User

ESSENTIAL = {"full_name": "Ana Souza", "phone": "(41) 99111-0002", "city": "Curitiba"}


class CandidateProfileRulesTestCase(unittest.TestCase):
    """Only name, phone/WhatsApp and city are required; links are optional but must look like links."""

    def setUp(self) -> None:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
        with self.SessionLocal() as db:
            user = User(name="Ana", email="ana@example.com", hashed_password="x", role="candidate", is_active=True)
            db.add(user)
            db.flush()
            db.add(Candidate(user_id=user.id, full_name="Ana"))
            db.commit()
            self.user_id = user.id

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        install_error_handlers(app)
        app.include_router(candidates.router, prefix="/candidates")
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)
        self.headers = {"Authorization": f"Bearer {create_access_token(self.user_id)}"}

    def save(self, **fields):
        return self.client.put("/candidates/me", json=fields, headers=self.headers)

    def detail(self, response) -> str:
        detail = response.json()["detail"]
        return detail if isinstance(detail, str) else " ".join(item["msg"] for item in detail)

    def test_only_the_essentials_are_enough(self) -> None:
        response = self.save(**ESSENTIAL, linkedin_url="", portfolio_url="", resume_url="", work_mode="", salary_expectation=None)
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["email"], "ana@example.com")
        for field in ("linkedin_url", "portfolio_url", "resume_url", "work_mode", "salary_expectation"):
            self.assertIsNone(body[field], field)

    def test_essentials_are_required_with_portuguese_messages(self) -> None:
        for field, message in (
            ("full_name", messages.PROFILE_NAME_REQUIRED),
            ("phone", messages.PROFILE_PHONE_REQUIRED),
            ("city", messages.PROFILE_CITY_REQUIRED),
        ):
            with self.subTest(field=field):
                response = self.save(**{**ESSENTIAL, field: "  "})
                self.assertEqual(response.status_code, 422)
                self.assertIn(message, self.detail(response))
        short_phone = self.save(**{**ESSENTIAL, "phone": "9999"})
        self.assertIn(messages.INVALID_PHONE, self.detail(short_phone))

    def test_links_are_checked_only_when_filled_in(self) -> None:
        ok = self.save(**ESSENTIAL, linkedin_url="linkedin.com/in/ana-souza", portfolio_url=" https://ana.dev ", resume_url="https://drive.google.com/file/d/1")
        self.assertEqual(ok.status_code, 200, ok.text)
        self.assertEqual(ok.json()["linkedin_url"], "https://linkedin.com/in/ana-souza")
        self.assertEqual(ok.json()["portfolio_url"], "https://ana.dev")
        self.assertEqual(ok.json()["resume_url"], "https://drive.google.com/file/d/1")

        for field, value, message in (
            ("linkedin_url", "meu linkedin", messages.INVALID_LINKEDIN_URL),
            ("portfolio_url", "ftp://site.com", messages.INVALID_PORTFOLIO_URL),
            ("resume_url", "curriculo", messages.INVALID_RESUME_URL),
        ):
            with self.subTest(field=field):
                response = self.save(**ESSENTIAL, **{field: value})
                self.assertEqual(response.status_code, 422)
                self.assertIn(message, self.detail(response))

    def test_optional_fields_can_be_cleared(self) -> None:
        self.save(**ESSENTIAL, professional_summary="Atendimento ao cliente.", linkedin_url="https://linkedin.com/in/ana")
        cleared = self.save(**ESSENTIAL, professional_summary="", linkedin_url="")
        self.assertIsNone(cleared.json()["professional_summary"])
        self.assertIsNone(cleared.json()["linkedin_url"])

    def test_work_mode_accepts_only_known_values(self) -> None:
        self.assertEqual(self.save(**ESSENTIAL, work_mode="hybrid").json()["work_mode"], "hybrid")
        self.assertEqual(self.save(**ESSENTIAL, work_mode="qualquer").status_code, 422)


if __name__ == "__main__":
    unittest.main()
