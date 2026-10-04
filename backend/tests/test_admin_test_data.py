import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import admin, auth, candidates, companies, jobs, recruiter
from app.core.rate_limit import limiter
from app.core.security import create_access_token, get_password_hash
from app.database.base import Base
from app.database.session import get_db
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.user import User


class AdminTestDataTestCase(unittest.TestCase):
    """Deactivate (never delete) test companies/candidates and hide test applications."""

    def setUp(self) -> None:
        limiter.reset()
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

        with self.SessionLocal() as db:
            self.users = {}
            for key, role in (("admin", "admin"), ("recruiter", "recruiter"), ("company", "company"), ("candidate", "candidate")):
                user = User(name=f"Pessoa {key}", email=f"{key}@example.com", hashed_password=get_password_hash("senha-forte-1"), role=role, is_active=True)
                db.add(user)
                self.users[key] = user
            db.flush()
            self.company = Company(user_id=self.users["company"].id, company_name="Empresa TESTE", status="approved")
            db.add(self.company)
            db.flush()
            self.job = Job(company_id=self.company.id, title="Vaga TESTE", slug="vaga-teste", description="Vaga de teste.", status="approved", is_active=True)
            db.add(self.job)
            db.flush()
            self.account_candidate = Candidate(user_id=self.users["candidate"].id, full_name="Cândida Conta")
            self.public_candidate = Candidate(full_name="Pedro Sem Conta", email="pedro@example.com", phone="41999990000")
            db.add_all([self.account_candidate, self.public_candidate])
            db.flush()
            self.account_application = Application(candidate_id=self.account_candidate.id, job_id=self.job.id, stage="screening")
            self.public_application = Application(candidate_id=self.public_candidate.id, job_id=self.job.id, stage="new")
            db.add_all([self.account_application, self.public_application])
            db.commit()

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        for module, prefix in ((admin, "/admin"), (auth, "/auth"), (candidates, "/candidates"), (companies, "/companies"), (jobs, "/jobs"), (recruiter, "/recruiter")):
            app.include_router(module.router, prefix=prefix)
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self) -> None:
        limiter.reset()

    def call(self, method: str, path: str, role: str | None = "admin", **kwargs):
        headers = {"Authorization": f"Bearer {create_access_token(self.users[role].id)}"} if role else {}
        return self.client.request(method, path, headers=headers, **kwargs)

    def login(self, key: str):
        return self.client.post("/auth/login", json={"email": f"{key}@example.com", "password": "senha-forte-1"})

    def test_deactivated_company_cannot_log_in_and_its_jobs_disappear(self) -> None:
        response = self.call("PUT", f"/admin/companies/{self.company.id}/active", json={"is_active": False})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(response.json()["is_active"])

        self.assertEqual(self.login("company").status_code, 403)
        self.assertEqual(self.call("GET", "/companies/me/finalists", role="company").status_code, 403)
        self.assertEqual(self.client.get("/jobs").json(), [])
        self.assertEqual(self.client.get("/jobs/vaga-teste").status_code, 404)
        apply = self.client.post(
            "/jobs/vaga-teste/applications",
            json={"full_name": "Nova", "email": "nova@example.com", "phone": "41988887777", "city": "Curitiba", "neighborhood": "Centro", "privacy_accepted": True},
        )
        self.assertEqual(apply.status_code, 404)
        self.assertEqual(self.call("GET", "/recruiter/jobs", role="recruiter").json()["jobs"], [])

        # Nothing was deleted: reactivating brings everything back.
        self.call("PUT", f"/admin/companies/{self.company.id}/active", json={"is_active": True})
        self.assertEqual(self.login("company").status_code, 200)
        self.assertEqual(len(self.client.get("/jobs").json()), 1)
        self.assertEqual(len(self.call("GET", "/recruiter/jobs", role="recruiter").json()["jobs"]), 1)

    def test_deactivated_candidate_is_blocked_and_hidden_everywhere(self) -> None:
        response = self.call("PUT", f"/admin/candidates/{self.account_candidate.id}/active", json={"is_active": False})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(response.json()["is_active"])
        self.assertEqual(self.login("candidate").status_code, 403)

        pipeline = self.call("GET", f"/recruiter/jobs/{self.job.id}/applications", role="recruiter").json()
        self.assertEqual([card["candidate_name"] for card in pipeline["applications"]], ["Pedro Sem Conta"])
        self.assertEqual([item["candidate_name"] for item in self.call("GET", "/admin/applications").json()], ["Pedro Sem Conta"])

        self.call("PUT", f"/admin/candidates/{self.account_candidate.id}/active", json={"is_active": True})
        self.assertEqual(self.login("candidate").status_code, 200)
        self.assertEqual(len(self.call("GET", "/admin/applications").json()), 2)

    def test_candidate_without_account_is_deactivated_by_hiding_applications(self) -> None:
        response = self.call("PUT", f"/admin/candidates/{self.public_candidate.id}/active", json={"is_active": False})
        self.assertFalse(response.json()["is_active"])
        with self.SessionLocal() as db:
            self.assertTrue(db.get(Application, self.public_application.id).is_hidden)
            self.assertIsNotNone(db.get(Candidate, self.public_candidate.id))  # never deleted

    def test_hide_application_and_show_hidden_filter(self) -> None:
        hidden = self.call("PUT", f"/admin/applications/{self.public_application.id}/hidden", json={"is_hidden": True})
        self.assertEqual(hidden.status_code, 200)
        self.assertTrue(hidden.json()["is_hidden"])

        self.assertEqual(len(self.call("GET", "/admin/applications").json()), 1)
        everything = self.call("GET", "/admin/applications?include_hidden=true").json()
        self.assertEqual({item["candidate_name"]: item["is_hidden"] for item in everything}, {"Cândida Conta": False, "Pedro Sem Conta": True})
        self.assertEqual(everything[0]["stage_label"] in {"Nova", "Em triagem"}, True)

        counts = self.call("GET", "/recruiter/jobs", role="recruiter").json()["jobs"][0]["stage_counts"]
        self.assertEqual(counts["new"], 0)
        self.assertEqual(counts["screening"], 1)

    def test_only_admin_deactivates_or_hides(self) -> None:
        for role in ("recruiter", "company", "candidate"):
            self.assertEqual(self.call("PUT", f"/admin/companies/{self.company.id}/active", role=role, json={"is_active": False}).status_code, 403, role)
            self.assertEqual(self.call("PUT", f"/admin/candidates/{self.public_candidate.id}/active", role=role, json={"is_active": False}).status_code, 403, role)
            self.assertEqual(self.call("PUT", f"/admin/applications/{self.public_application.id}/hidden", role=role, json={"is_hidden": True}).status_code, 403, role)
        self.assertEqual(self.call("PUT", f"/admin/applications/{self.public_application.id}/hidden", role=None, json={"is_hidden": True}).status_code, 401)
        with self.SessionLocal() as db:
            self.assertFalse(db.get(Application, self.public_application.id).is_hidden)
            self.assertTrue(db.get(User, self.users["company"].id).is_active)

    def test_unknown_ids(self) -> None:
        self.assertEqual(self.call("PUT", "/admin/companies/999/active", json={"is_active": False}).status_code, 404)
        self.assertEqual(self.call("PUT", "/admin/candidates/999/active", json={"is_active": False}).status_code, 404)
        self.assertEqual(self.call("PUT", "/admin/applications/999/hidden", json={"is_hidden": True}).status_code, 404)


if __name__ == "__main__":
    unittest.main()
