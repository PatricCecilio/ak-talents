import unittest
from unittest import mock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import admin, auth, recruiter
from app.core.rate_limit import limiter
from app.core.security import create_access_token
from app.database.base import Base
from app.database.session import get_db
from app.models.company import Company
from app.models.job import Job
from app.models.user import User
from app.scripts import create_admin, create_recruiter

FORBIDDEN = "Você não tem permissão para acessar esta área."


class RecruiterRoleTestCase(unittest.TestCase):
    """End to end with real JWTs: every role is checked against what it must NOT reach."""

    def setUp(self) -> None:
        limiter.reset()
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

        with self.SessionLocal() as db:
            self.users = {}
            for role in ("admin", "recruiter", "company", "candidate"):
                user = User(name=f"Pessoa {role}", email=f"{role}@example.com", hashed_password="x", role=role, is_active=True)
                db.add(user)
                self.users[role] = user
            db.flush()
            company = Company(user_id=self.users["company"].id, company_name="Empresa", status="pending")
            db.add(company)
            db.flush()
            self.company_id = company.id
            job = Job(company_id=company.id, title="Atendente", slug="atendente", description="Atendimento ao público.", status="pending")
            db.add(job)
            db.commit()
            self.job_id = job.id

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        app.include_router(auth.router, prefix="/auth")
        app.include_router(admin.router, prefix="/admin")
        app.include_router(recruiter.router, prefix="/recruiter")
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self) -> None:
        limiter.reset()

    def headers(self, role: str) -> dict:
        return {"Authorization": f"Bearer {create_access_token(self.users[role].id)}"}

    def call(self, role: str | None, method: str, path: str, **kwargs):
        headers = self.headers(role) if role else {}
        return self.client.request(method, path, headers=headers, **kwargs)

    # --- public sign-up never creates staff ---

    def test_public_sign_up_cannot_create_recruiter_or_admin(self) -> None:
        for role in ("recruiter", "admin"):
            response = self.client.post(
                "/auth/register",
                json={"name": "Invasor", "email": f"x-{role}@example.com", "password": "senha-forte-1", "role": role, "privacy_accepted": True},
            )
            self.assertEqual(response.status_code, 403, role)
        with self.SessionLocal() as db:
            self.assertEqual(db.query(User).filter(User.email.like("x-%")).count(), 0)

    # --- admin creates recruiters ---

    def test_admin_creates_recruiter(self) -> None:
        response = self.call("admin", "POST", "/admin/recruiters", json={"name": "Rita Recrutadora", "email": "Rita@AK.com", "password": "senha-bem-longa-1"})
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["role"], "recruiter")
        self.assertEqual(response.json()["email"], "rita@ak.com")
        listed = self.call("admin", "GET", "/admin/recruiters").json()
        self.assertIn("rita@ak.com", {member["email"] for member in listed})

    def test_recruiter_creation_errors_are_in_portuguese(self) -> None:
        short = self.call("admin", "POST", "/admin/recruiters", json={"name": "Rita", "email": "rita@ak.com", "password": "curta"})
        self.assertEqual(short.status_code, 422)
        self.assertIn("pelo menos 12", short.json()["detail"])
        taken = self.call("admin", "POST", "/admin/recruiters", json={"name": "Rita", "email": "recruiter@example.com", "password": "senha-bem-longa-1"})
        self.assertEqual(taken.status_code, 409)
        self.assertEqual(taken.json()["detail"], "Já existe um usuário com este e-mail.")

    def test_only_admin_manages_recruiters(self) -> None:
        payload = {"name": "Rita", "email": "rita@ak.com", "password": "senha-bem-longa-1"}
        for role in ("recruiter", "company", "candidate"):
            self.assertEqual(self.call(role, "POST", "/admin/recruiters", json=payload).status_code, 403, role)
            self.assertEqual(self.call(role, "GET", "/admin/recruiters").status_code, 403, role)
        self.assertEqual(self.call(None, "POST", "/admin/recruiters", json=payload).status_code, 401)

    # --- what a recruiter can and cannot do ---

    def test_recruiter_operates_jobs_and_screening(self) -> None:
        self.assertEqual(self.call("recruiter", "GET", "/admin/jobs").status_code, 200)
        self.assertEqual(self.call("recruiter", "GET", f"/admin/jobs/{self.job_id}/screening-questions").status_code, 200)
        approved = self.call("recruiter", "PUT", f"/admin/jobs/{self.job_id}/approve")
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.json()["status"], "approved")
        self.assertEqual(self.call("recruiter", "PUT", f"/admin/jobs/{self.job_id}/hide").status_code, 200)

    def test_recruiter_cannot_manage_companies_users_candidates_or_applications(self) -> None:
        for method, path in [
            ("GET", "/admin/users"),
            ("GET", "/admin/companies"),
            ("GET", "/admin/candidates"),
            ("GET", "/admin/applications"),
            ("PUT", f"/admin/companies/{self.company_id}/approve"),
            ("PUT", f"/admin/companies/{self.company_id}/block"),
        ]:
            response = self.call("recruiter", method, path)
            self.assertEqual(response.status_code, 403, path)
            self.assertEqual(response.json()["detail"], FORBIDDEN)

    def test_company_and_candidate_cannot_reach_staff_routes(self) -> None:
        for role in ("company", "candidate"):
            for method, path in [
                ("GET", "/admin/jobs"),
                ("PUT", f"/admin/jobs/{self.job_id}/approve"),
                ("GET", "/recruiter/team"),
                ("PUT", f"/recruiter/jobs/{self.job_id}/responsible"),
            ]:
                kwargs = {"json": {"recruiter_id": None}} if path.endswith("responsible") else {}
                self.assertEqual(self.call(role, method, path, **kwargs).status_code, 403, f"{role} {path}")

    def test_inactive_recruiter_is_refused(self) -> None:
        with self.SessionLocal() as db:
            db.query(User).filter(User.id == self.users["recruiter"].id).update({"is_active": False})
            db.commit()
        self.assertEqual(self.call("recruiter", "GET", "/admin/jobs").status_code, 403)

    # --- responsible recruiter on the job ---

    def test_staff_assigns_and_clears_responsible_recruiter(self) -> None:
        recruiter_id = self.users["recruiter"].id
        response = self.call("recruiter", "PUT", f"/recruiter/jobs/{self.job_id}/responsible", json={"recruiter_id": recruiter_id})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["recruiter_id"], recruiter_id)
        self.assertEqual(response.json()["recruiter_name"], "Pessoa recruiter")

        team = self.call("admin", "GET", "/recruiter/team").json()
        self.assertEqual({member["role"] for member in team}, {"admin", "recruiter"})

        cleared = self.call("admin", "PUT", f"/recruiter/jobs/{self.job_id}/responsible", json={"recruiter_id": None})
        self.assertIsNone(cleared.json()["recruiter_id"])

    def test_responsible_must_be_active_staff(self) -> None:
        for user_role in ("company", "candidate"):
            response = self.call("admin", "PUT", f"/recruiter/jobs/{self.job_id}/responsible", json={"recruiter_id": self.users[user_role].id})
            self.assertEqual(response.status_code, 422)
            self.assertEqual(response.json()["detail"], "Escolha um recrutador ativo da equipe AK Talent.")
        self.assertEqual(self.call("admin", "PUT", "/recruiter/jobs/9999/responsible", json={"recruiter_id": None}).status_code, 404)


class CreateRecruiterCliTestCase(unittest.TestCase):
    def test_cli_creates_recruiter(self) -> None:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
        with mock.patch("builtins.input", side_effect=["Rita", "rita@ak.com", "s"]), mock.patch.object(
            create_admin, "getpass", side_effect=["senha-bem-longa-1", "senha-bem-longa-1"]
        ), mock.patch("app.database.session.SessionLocal", SessionLocal), mock.patch("builtins.print"):
            self.assertEqual(create_recruiter.main(), 0)
        with SessionLocal() as db:
            self.assertEqual(db.query(User).filter(User.role == "recruiter").one().email, "rita@ak.com")


if __name__ == "__main__":
    unittest.main()
