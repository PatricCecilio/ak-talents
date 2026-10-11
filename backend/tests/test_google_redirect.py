import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock
from urllib.parse import parse_qs, urlparse

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import auth
from app.core.config import settings
from app.core.errors import install_error_handlers
from app.core.rate_limit import limiter
from app.core.security import get_password_hash
from app.database.base import Base
from app.database.session import get_db
from app.models.company import Company
from app.models.login_code import LoginCode
from app.models.user import User
from tests.test_google_auth import CERT_PEM, CLIENT_ID, KID, google_token

SITE = "https://www.aktalent.com.br"
CSRF = "csrf-valor-de-teste-123"


class GoogleRedirectTestCase(unittest.TestCase):
    def setUp(self) -> None:
        limiter.reset()
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        install_error_handlers(app)
        app.include_router(auth.router, prefix="/auth")
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)
        for patcher in (
            mock.patch("google.oauth2.id_token._fetch_certs", return_value={KID: CERT_PEM}),
            mock.patch.object(settings, "GOOGLE_CLIENT_ID", CLIENT_ID),
            # The company door is covered here too; tests/test_company_portal_closed.py covers the portal off.
            mock.patch.object(settings, "COMPANY_PORTAL_ENABLED", True),
            mock.patch.object(settings, "FRONTEND_URL", SITE),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def google_post(self, door="candidato", token=None, csrf_form=CSRF, csrf_cookie=CSRF):
        """What the browser sends after Google: form POST + the g_csrf_token cookie set on the site's domain."""
        self.client.cookies.clear()
        if csrf_cookie is not None:
            self.client.cookies.set("g_csrf_token", csrf_cookie)
        response = self.client.post(
            f"/auth/google/redirect/{door}",
            data={"credential": token or google_token(), "g_csrf_token": csrf_form},
            follow_redirects=False,
        )
        self.assertEqual(response.status_code, 303, response.text)
        location = urlparse(response.headers["location"])
        self.assertEqual(f"{location.scheme}://{location.netloc}", SITE)
        return location.path, {key: values[0] for key, values in parse_qs(location.query).items()}

    def add_user(self, email: str, role: str) -> int:
        with self.SessionLocal() as db:
            user = User(name="Pessoa", email=email, hashed_password=get_password_hash("senha-antiga-123"), role=role, is_active=True)
            db.add(user)
            db.commit()
            return user.id

    def users(self) -> int:
        with self.SessionLocal() as db:
            return db.query(User).count()

    # --- CSRF and token ------------------------------------------------------------------------------

    def test_csrf_missing_or_different_is_refused(self) -> None:
        for form, cookie in ((CSRF, None), ("", CSRF), (CSRF, "outro-valor")):
            path, query = self.google_post(csrf_form=form, csrf_cookie=cookie)
            self.assertEqual((path, query), ("/entrar/candidato", {"erro": "csrf"}))
        self.assertEqual(self.users(), 0)

    def test_invalid_token_wrong_audience_unverified_email(self) -> None:
        self.assertEqual(self.google_post(token="x" * 40)[1], {"erro": "token"})
        self.assertEqual(self.google_post(token=google_token(aud="outro.apps.googleusercontent.com"))[1], {"erro": "token"})
        self.assertEqual(self.google_post(door="empresa", token=google_token(email_verified=False)), ("/entrar/empresa", {"erro": "email_nao_verificado"}))
        self.assertEqual(self.users(), 0)

    # --- new accounts: consent first -----------------------------------------------------------------

    def test_new_candidate_goes_through_consent_then_gets_a_session(self) -> None:
        path, query = self.google_post(door="candidato")
        self.assertEqual(path, "/entrar/google")
        self.assertEqual(set(query), {"consentimento"})
        self.assertEqual(self.users(), 0, "a conta só nasce depois do aceite")

        refused = self.client.post("/auth/google/consentimento", json={"codigo": query["consentimento"], "privacy_accepted": False})
        self.assertEqual(refused.status_code, 422)

        done = self.client.post("/auth/google/consentimento", json={"codigo": query["consentimento"], "privacy_accepted": True})
        self.assertEqual(done.status_code, 200, done.text)
        body = done.json()
        self.assertEqual((body["user"]["role"], body["created"], body["door"]), ("candidate", True, "candidato"))
        with self.SessionLocal() as db:
            user = db.query(User).one()
            self.assertIsNotNone(user.privacy_accepted_at)
            self.assertEqual(user.google_sub, "google-sub-ana")

        again = self.client.post("/auth/google/consentimento", json={"codigo": query["consentimento"], "privacy_accepted": True})
        self.assertEqual(again.status_code, 400, "código de uso único")

    def test_new_company_from_the_company_door(self) -> None:
        _, query = self.google_post(door="empresa", token=google_token(sub="sub-loja", email="loja@gmail.com", name="Mercado"))
        body = self.client.post("/auth/google/consentimento", json={"codigo": query["consentimento"], "privacy_accepted": True}).json()
        self.assertEqual(body["user"]["role"], "company")
        with self.SessionLocal() as db:
            self.assertEqual(db.query(Company).one().status, "pending")

    # --- existing accounts ---------------------------------------------------------------------------

    def test_existing_account_gets_a_one_time_session_code(self) -> None:
        self.add_user("ana@gmail.com", "candidate")
        path, query = self.google_post(door="empresa")  # wrong door: the role stays candidate
        self.assertEqual((path, set(query)), ("/entrar/google", {"codigo"}))

        first = self.client.post("/auth/google/codigo", json={"codigo": query["codigo"]})
        self.assertEqual(first.status_code, 200, first.text)
        body = first.json()
        self.assertEqual((body["user"]["role"], body["linked"], body["door"]), ("candidate", True, "empresa"))
        self.assertTrue(body["access_token"])

        second = self.client.post("/auth/google/codigo", json={"codigo": query["codigo"]})
        self.assertEqual(second.status_code, 400)
        self.assertEqual(second.json()["detail"], "Este link de login expirou ou já foi usado. Toque de novo em Continuar com o Google.")
        # Password invalidated by the link.
        self.assertEqual(self.client.post("/auth/login", json={"email": "ana@gmail.com", "password": "senha-antiga-123"}).status_code, 401)

    def test_expired_tampered_or_wrong_purpose_codes_are_refused(self) -> None:
        self.add_user("ana@gmail.com", "candidate")
        _, query = self.google_post()
        with self.SessionLocal() as db:
            row = db.query(LoginCode).one()
            self.assertNotEqual(row.code_hash, query["codigo"], "o código não é guardado em texto")
            row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            db.commit()
        self.assertEqual(self.client.post("/auth/google/codigo", json={"codigo": query["codigo"]}).status_code, 400)
        self.assertEqual(self.client.post("/auth/google/codigo", json={"codigo": query["codigo"][:-2] + "xx"}).status_code, 400)
        # A session code is not a consent code.
        _, fresh = self.google_post()
        self.assertEqual(self.client.post("/auth/google/consentimento", json={"codigo": fresh["codigo"], "privacy_accepted": True}).status_code, 400)

    def test_team_accounts_are_sent_to_equipe_without_a_code(self) -> None:
        self.add_user("ana@gmail.com", "recruiter")
        self.assertEqual(self.google_post(), ("/entrar/candidato", {"erro": "equipe"}))
        with self.SessionLocal() as db:
            self.assertEqual(db.query(LoginCode).count(), 0)
            self.assertIsNone(db.query(User).one().google_sub)

    def test_session_code_lives_60_seconds(self) -> None:
        self.add_user("ana@gmail.com", "candidate")
        self.google_post()
        with self.SessionLocal() as db:
            row = db.query(LoginCode).one()
            created = row.created_at.replace(tzinfo=timezone.utc) if row.created_at.tzinfo is None else row.created_at
            expires = row.expires_at.replace(tzinfo=timezone.utc) if row.expires_at.tzinfo is None else row.expires_at
            self.assertLessEqual((expires - created).total_seconds(), 61)


if __name__ == "__main__":
    unittest.main()
