import time
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from google.auth import crypt
from google.auth import jwt as google_jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.api.routes import auth
from app.core.config import settings
from app.core.errors import install_error_handlers
from app.core.privacy import PRIVACY_POLICY_VERSION
from app.core.rate_limit import limiter
from app.core.security import create_access_token, get_password_hash
from app.database.base import Base
from app.database.session import get_db
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.user import User, UserRole
from app.services.staff_service import StaffCreationError, create_staff_user

CLIENT_ID = "1234567890-teste.apps.googleusercontent.com"
KID = "chave-de-teste"


def _test_key_and_cert() -> tuple[bytes, bytes]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "google-teste")])
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=1))
        .sign(key, hashes.SHA256())
    )
    private_pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    return private_pem, cert.public_bytes(serialization.Encoding.PEM)


PRIVATE_PEM, CERT_PEM = _test_key_and_cert()
OTHER_PRIVATE_PEM, _ = _test_key_and_cert()  # not trusted: signs "tampered" tokens


def google_token(*, private_pem: bytes = PRIVATE_PEM, **overrides) -> str:
    now = int(time.time())
    claims = {
        "iss": "https://accounts.google.com",
        "aud": CLIENT_ID,
        "sub": "google-sub-ana",
        "email": "ana@gmail.com",
        "email_verified": True,
        "name": "ANA DE SOUZA",
        "iat": now,
        "exp": now + 3600,
    }
    claims.update(overrides)
    signer = crypt.RSASigner.from_string(private_pem, key_id=KID)
    return google_jwt.encode(signer, claims).decode()


class GoogleSignInTestCase(unittest.TestCase):
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

        @app.get("/me")
        def me(user: User = Depends(get_current_user)):
            return {"id": user.id, "role": user.role}

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

        # Only Google's certificate download is replaced; google-auth's real verification runs.
        for patcher in (
            mock.patch("google.oauth2.id_token._fetch_certs", return_value={KID: CERT_PEM}),
            mock.patch.object(settings, "GOOGLE_CLIENT_ID", CLIENT_ID),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def sign_in(self, token: str | None = None, door: str = "candidato", privacy_accepted: bool = True):
        return self.client.post(
            "/auth/google",
            json={"credential": token or google_token(), "door": door, "privacy_accepted": privacy_accepted},
        )

    def add_user(self, email: str, role: str, password: str | None = "senha-antiga-123", **extra) -> int:
        with self.SessionLocal() as db:
            user = User(name="Pessoa", email=email, hashed_password=get_password_hash(password) if password else None, role=role, is_active=True, **extra)
            db.add(user)
            db.flush()
            if role == "candidate":
                db.add(Candidate(user_id=user.id, full_name="Pessoa", email=email))
            if role == "company":
                db.add(Company(user_id=user.id, company_name="Empresa", status="approved"))
            db.commit()
            return user.id

    def user(self, email: str) -> User:
        with self.SessionLocal() as db:
            return db.query(User).filter(User.email == email).one()

    # --- token checks ----------------------------------------------------------------------------

    def test_invalid_or_tampered_token_is_refused(self) -> None:
        for token in ("x" * 40, google_token(private_pem=OTHER_PRIVATE_PEM)):
            response = self.sign_in(token)
            self.assertEqual(response.status_code, 401, response.text)
            self.assertEqual(response.json()["detail"], "Não foi possível confirmar sua conta Google. Tente de novo.")

    def test_wrong_audience_wrong_issuer_and_expired_are_refused(self) -> None:
        for overrides in (
            {"aud": "outro-site.apps.googleusercontent.com"},
            {"iss": "https://falso.example.com"},
            {"iat": int(time.time()) - 7200, "exp": int(time.time()) - 3600},
        ):
            response = self.sign_in(google_token(**overrides))
            self.assertEqual(response.status_code, 401, overrides)
        self.assertEqual(self.SessionLocal().query(User).count(), 0)

    def test_unverified_google_email_is_refused(self) -> None:
        response = self.sign_in(google_token(email_verified=False))
        self.assertEqual(response.status_code, 401)
        self.assertIn("ainda não foi verificado", response.json()["detail"])

    def test_without_client_id_the_feature_is_off(self) -> None:
        with mock.patch.object(settings, "GOOGLE_CLIENT_ID", ""):
            response = self.sign_in()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "Login com Google indisponível no momento. Entre com e-mail e senha.")

    # --- new accounts ------------------------------------------------------------------------------

    def test_new_account_needs_privacy_consent(self) -> None:
        response = self.sign_in(privacy_accepted=False)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json(), {"detail": "Para criar sua conta, leia e aceite a Política de Privacidade.", "code": "consent_required"})
        self.assertEqual(self.SessionLocal().query(User).count(), 0)

    def test_new_candidate_from_the_candidate_door(self) -> None:
        response = self.sign_in(door="candidato")
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertTrue(body["created"])
        self.assertEqual(body["user"]["role"], "candidate")
        user = self.user("ana@gmail.com")
        self.assertEqual(user.name, "Ana de Souza")  # all caps from Google, normalized
        self.assertIsNone(user.hashed_password)
        self.assertEqual(user.google_sub, "google-sub-ana")
        self.assertIsNotNone(user.email_verified_at)
        self.assertIsNotNone(user.privacy_accepted_at)
        self.assertEqual(user.privacy_policy_version, PRIVACY_POLICY_VERSION)
        with self.SessionLocal() as db:
            self.assertEqual(db.query(Candidate).filter(Candidate.user_id == user.id).one().email, "ana@gmail.com")
        # The issued session works; signing in again finds the same account by its Google id.
        self.assertEqual(self.client.get("/me", headers={"Authorization": f"Bearer {body['access_token']}"}).status_code, 200)
        again = self.sign_in(privacy_accepted=False)
        self.assertEqual(again.status_code, 200)
        self.assertFalse(again.json()["created"])

    def test_new_company_from_the_company_door_follows_the_current_flow(self) -> None:
        response = self.sign_in(google_token(sub="google-sub-loja", email="loja@gmail.com", name="Mercado Bom Preço"), door="empresa")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["user"]["role"], "company")
        with self.SessionLocal() as db:
            company = db.query(Company).one()
        self.assertEqual(company.status, "pending")
        self.assertEqual(company.company_name, "Mercado Bom Preço")

    # --- existing accounts -------------------------------------------------------------------------

    def test_linking_an_existing_account_invalidates_the_old_password_and_sessions(self) -> None:
        user_id = self.add_user("Ana@Gmail.com", "candidate")
        old_session = create_access_token(user_id)
        self.assertEqual(self.client.get("/me", headers={"Authorization": f"Bearer {old_session}"}).status_code, 200)
        time.sleep(1.1)  # JWT "iat" has second precision

        response = self.sign_in(door="empresa")  # wrong door: the role stays candidate
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertTrue(body["linked"])
        self.assertFalse(body["created"])
        self.assertEqual(body["user"]["role"], "candidate")

        user = self.user("Ana@Gmail.com")
        self.assertIsNone(user.hashed_password)
        self.assertEqual(user.google_sub, "google-sub-ana")
        self.assertIsNotNone(user.email_verified_at)
        self.assertIsNotNone(user.sessions_valid_after)
        # Old session closed, new one valid.
        self.assertEqual(self.client.get("/me", headers={"Authorization": f"Bearer {old_session}"}).status_code, 401)
        self.assertEqual(self.client.get("/me", headers={"Authorization": f"Bearer {body['access_token']}"}).status_code, 200)
        # The old password no longer works, with a clear message (and nothing breaks).
        login = self.client.post("/auth/login", json={"email": "Ana@Gmail.com", "password": "senha-antiga-123"})
        self.assertEqual(login.status_code, 401)
        self.assertEqual(login.json()["detail"], "Esta conta usa o login com Google. Toque em Entrar com Google.")

    def test_team_accounts_are_never_linked(self) -> None:
        for role in ("admin", "recruiter"):
            with self.subTest(role=role):
                email = f"{role}@gmail.com"
                self.add_user(email, role)
                response = self.sign_in(google_token(sub=f"sub-{role}", email=email))
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.json()["detail"], "Use o acesso da equipe em /equipe.")
                self.assertNotIn("access_token", response.json())
                staff = self.user(email)
                self.assertIsNotNone(staff.hashed_password)
                self.assertIsNone(staff.google_sub)
                # Team keeps e-mail + password.
                self.assertEqual(self.client.post("/auth/login", json={"email": email, "password": "senha-antiga-123"}).status_code, 200)

    def test_staff_created_by_scripts_always_has_a_password(self) -> None:
        with self.SessionLocal() as db:
            for bad in ("", "curta"):
                with self.assertRaises(StaffCreationError):
                    create_staff_user(db, "Equipe", f"equipe{len(bad)}@aktalent.com.br", bad, UserRole.recruiter)
            db.rollback()
            staff = create_staff_user(db, "Equipe", "equipe@aktalent.com.br", "senha-bem-forte-123", UserRole.recruiter)
            self.assertIsNotNone(staff.hashed_password)
        login = self.client.post("/auth/login", json={"email": "equipe@aktalent.com.br", "password": "senha-bem-forte-123"})
        self.assertEqual(login.status_code, 200, login.text)

    def test_email_already_linked_to_another_google_account(self) -> None:
        self.add_user("ana@gmail.com", "candidate", google_sub="outro-sub")
        response = self.sign_in()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"], "Este e-mail já está ligado a outra conta Google.")

    def test_inactive_account(self) -> None:
        user_id = self.add_user("ana@gmail.com", "candidate")
        with self.SessionLocal() as db:
            db.get(User, user_id).is_active = False
            db.commit()
        self.assertEqual(self.sign_in().status_code, 403)

    def test_password_login_on_a_google_only_account_answers_clearly(self) -> None:
        self.sign_in()
        response = self.client.post("/auth/login", json={"email": "ana@gmail.com", "password": "qualquer-coisa"})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Esta conta usa o login com Google. Toque em Entrar com Google.")
        unknown = self.client.post("/auth/login", json={"email": "ninguem@gmail.com", "password": "qualquer-coisa"})
        self.assertEqual(unknown.json()["detail"], "E-mail ou senha inválidos.")

    # --- public applications -----------------------------------------------------------------------

    def test_public_applications_with_the_same_email_move_into_the_verified_account(self) -> None:
        with self.SessionLocal() as db:
            owner = User(name="Empresa", email="empresa@x.com", hashed_password="x", role="company", is_active=True)
            db.add(owner)
            db.flush()
            company = Company(user_id=owner.id, company_name="Empresa", status="approved")
            db.add(company)
            db.flush()
            jobs = [Job(company_id=company.id, title=f"Vaga {i}", slug=f"vaga-{i}", description="Descrição da vaga.", status="approved", is_active=True) for i in range(3)]
            db.add_all(jobs)
            db.flush()
            # Two public applications with Ana's e-mail (no account), one by someone else.
            public_ana = Candidate(full_name="Ana Pública", email="ANA@gmail.com", phone="41999990000")
            stranger = Candidate(full_name="Outra", email="outra@gmail.com")
            db.add_all([public_ana, stranger])
            db.flush()
            db.add_all([
                Application(candidate_id=public_ana.id, job_id=jobs[0].id),
                Application(candidate_id=public_ana.id, job_id=jobs[1].id),
                Application(candidate_id=stranger.id, job_id=jobs[2].id),
            ])
            db.commit()
            job_ids = [job.id for job in jobs]

        user_id = self.add_user("ana@gmail.com", "candidate")
        with self.SessionLocal() as db:
            account = db.query(Candidate).filter(Candidate.user_id == user_id).one()
            # The account already applied to job 1 itself: that public one stays where it is.
            db.add(Application(candidate_id=account.id, job_id=job_ids[1]))
            db.commit()
            account_id = account.id

        response = self.sign_in()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["linked_applications"], 1)
        with self.SessionLocal() as db:
            mine = {app.job_id for app in db.query(Application).filter(Application.candidate_id == account_id)}
            self.assertEqual(mine, {job_ids[0], job_ids[1]})
            # Profile data untouched; the stranger's application untouched.
            self.assertEqual(db.get(Candidate, account_id).full_name, "Pessoa")
            self.assertIsNone(db.get(Candidate, account_id).phone)
            self.assertEqual(db.query(Application).filter(Application.job_id == job_ids[2]).one().candidate_id != account_id, True)


if __name__ == "__main__":
    unittest.main()
