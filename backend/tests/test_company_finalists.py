import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import companies, recruiter
from app.core.security import create_access_token
from app.database.base import Base
from app.database.session import get_db
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.pipeline import ApplicationStageHistory
from app.models.user import User


class CompanyFinalistsTestCase(unittest.TestCase):
    def setUp(self) -> None:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

        with self.SessionLocal() as db:
            self.users = {}
            for key, role in (("company", "company"), ("other_company", "company"), ("recruiter", "recruiter"), ("candidate", "candidate")):
                user = User(name=f"Pessoa {key}", email=f"{key}@example.com", hashed_password="x", role=role, is_active=True)
                db.add(user)
                self.users[key] = user
            db.flush()
            company = Company(user_id=self.users["company"].id, company_name="Mercado Bom", status="approved")
            other = Company(user_id=self.users["other_company"].id, company_name="Outra", status="approved")
            db.add_all([company, other])
            db.flush()
            self.job = Job(company_id=company.id, title="Caixa", slug="caixa", description="Operar o caixa.", status="approved", is_active=True)
            other_job = Job(company_id=other.id, title="Estoquista", slug="estoquista", description="Estoque.", status="approved", is_active=True)
            db.add_all([self.job, other_job])
            db.flush()

            def application(name: str, stage: str, job: Job = self.job, hidden: bool = False) -> int:
                candidate = Candidate(full_name=name, email=f"{name.lower()}@example.com", phone="41999990000", city="Curitiba", experience_years=3)
                db.add(candidate)
                db.flush()
                item = Application(candidate_id=candidate.id, job_id=job.id, stage=stage, is_hidden=hidden, finalist_summary=f"Parecer de {name}")
                db.add(item)
                db.flush()
                return item.id

            self.finalist = application("Ana", "finalist")
            self.finalist2 = application("Bia", "finalist")
            self.approved = application("Caio", "client_approved")
            self.in_screening = application("Duda", "screening")
            self.interview = application("Edu", "ak_interview")
            self.hidden_finalist = application("Fê", "finalist", hidden=True)
            self.other_finalist = application("Gil", "finalist", job=other_job)
            db.commit()

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        app.include_router(companies.router, prefix="/companies")
        app.include_router(recruiter.router, prefix="/recruiter")
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def call(self, method: str, path: str, role: str | None = "company", **kwargs):
        headers = {"Authorization": f"Bearer {create_access_token(self.users[role].id)}"} if role else {}
        return self.client.request(method, path, headers=headers, **kwargs)

    def decide(self, application_id: int, decision: str, role: str = "company", reason: str | None = None):
        body = {"decision": decision, **({"reason": reason} if reason else {})}
        return self.call("POST", f"/companies/me/finalists/{application_id}/decision", role=role, json=body)

    def stage(self, application_id: int) -> str:
        with self.SessionLocal() as db:
            return db.get(Application, application_id).stage

    def test_company_sees_only_its_own_visible_finalists_without_contact(self) -> None:
        body = self.call("GET", "/companies/me/finalists").json()
        self.assertEqual([item["candidate_name"] for item in body["pending"]], ["Ana", "Bia"])
        for item in body["pending"]:
            self.assertIsNone(item["phone"])
            self.assertIsNone(item["email"])
            self.assertEqual(item["status"], "pending")
            self.assertTrue(item["finalist_summary"].startswith("Parecer de"))
            self.assertEqual(item["experience_years"], 3)
            self.assertEqual(item["city"], "Curitiba")
        all_names = {item["candidate_name"] for item in body["pending"] + body["approved"]}
        self.assertNotIn("Duda", all_names)  # not a finalist
        self.assertNotIn("Fê", all_names)  # hidden
        self.assertNotIn("Gil", all_names)  # another company

    def test_contact_appears_only_after_approval(self) -> None:
        approved = self.call("GET", "/companies/me/finalists").json()["approved"]
        self.assertEqual([(item["candidate_name"], item["phone"], item["email"]) for item in approved], [("Caio", "41999990000", "caio@example.com")])

        response = self.decide(self.finalist, "approve")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "approved")
        self.assertEqual(response.json()["phone"], "41999990000")
        self.assertEqual(self.stage(self.finalist), "client_approved")

    def test_reject_with_reason_is_recorded_in_history_for_the_recruiter(self) -> None:
        response = self.decide(self.finalist2, "reject", reason="Perfil sem experiência com caixa")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["phone"])
        self.assertEqual(self.stage(self.finalist2), "rejected")

        with self.SessionLocal() as db:
            entry = db.query(ApplicationStageHistory).filter(ApplicationStageHistory.application_id == self.finalist2).one()
        self.assertEqual((entry.from_stage, entry.to_stage, entry.changed_by_role), ("finalist", "rejected", "company"))
        self.assertEqual(entry.changed_by_user_id, self.users["company"].id)
        self.assertEqual(entry.note, "Recusado pela empresa. Motivo: Perfil sem experiência com caixa")

        detail = self.call("GET", f"/recruiter/applications/{self.finalist2}", role="recruiter").json()
        self.assertEqual(detail["history"][-1]["changed_by_role"], "company")

    def test_company_can_only_decide_on_waiting_finalists_of_its_own_jobs(self) -> None:
        for application_id in (self.in_screening, self.interview, self.approved):
            response = self.decide(application_id, "approve")
            self.assertEqual(response.status_code, 409, application_id)
            self.assertEqual(response.json()["detail"], "Este candidato não está aguardando a sua decisão.")
        self.assertEqual(self.decide(self.other_finalist, "approve").status_code, 404)
        self.assertEqual(self.decide(self.hidden_finalist, "approve").status_code, 404)
        self.assertEqual(self.stage(self.other_finalist), "finalist")

    def test_company_cannot_use_recruiter_routes_to_move_stages(self) -> None:
        response = self.call("POST", f"/recruiter/applications/{self.in_screening}/stage", json={"to_stage": "ak_interview"})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.call("GET", f"/recruiter/applications/{self.finalist}").status_code, 403)

    def test_recruiter_and_candidate_cannot_decide_as_the_company(self) -> None:
        for role in ("recruiter", "candidate"):
            self.assertEqual(self.decide(self.finalist, "approve", role=role).status_code, 403, role)
            self.assertEqual(self.call("GET", "/companies/me/finalists", role=role).status_code, 403, role)
        self.assertEqual(self.call("GET", "/companies/me/finalists", role=None).status_code, 401)
        self.assertEqual(self.stage(self.finalist), "finalist")

    def test_company_jobs_show_counts_per_stage_without_names(self) -> None:
        jobs = self.call("GET", "/companies/me/jobs").json()
        self.assertEqual(len(jobs), 1)
        counts = jobs[0]["stage_counts"]
        self.assertEqual(counts["finalist"], 2)  # hidden one excluded
        self.assertEqual(counts["client_approved"], 1)
        self.assertEqual(counts["screening"], 1)
        self.assertEqual(counts["ak_interview"], 1)
        self.assertNotIn("Ana", str(jobs))


if __name__ == "__main__":
    unittest.main()
