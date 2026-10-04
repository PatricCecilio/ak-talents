import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import candidates, recruiter
from app.core.pipeline import CANDIDATE_VIEW, Stage
from app.core.security import create_access_token
from app.database.base import Base
from app.database.session import get_db
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.user import User

EXPECTED = {
    "new": ("Recebida", 1, "in_progress"),
    "screening": ("Em análise", 2, "in_progress"),
    "ak_interview": ("Entrevista", 3, "in_progress"),
    "finalist": ("Na etapa final", 4, "in_progress"),
    "client_approved": ("Na etapa final", 4, "in_progress"),
    "hired": ("Parabéns, você foi selecionado(a)!", 4, "hired"),
    "rejected": ("Processo encerrado", None, "closed"),
    "withdrawn": ("Processo encerrado", None, "closed"),
}


class CandidateApplicationsTestCase(unittest.TestCase):
    def setUp(self) -> None:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

        with self.SessionLocal() as db:
            self.users = {}
            for key, role in (("me", "candidate"), ("other", "candidate"), ("company", "company"), ("recruiter", "recruiter")):
                user = User(name=f"Pessoa {key}", email=f"{key}@example.com", hashed_password="x", role=role, is_active=True)
                db.add(user)
                self.users[key] = user
            db.flush()
            company = Company(user_id=self.users["company"].id, company_name="Mercado Bom", status="approved")
            db.add(company)
            db.flush()
            me = Candidate(user_id=self.users["me"].id, full_name="Eu")
            other = Candidate(user_id=self.users["other"].id, full_name="Outra pessoa")
            db.add_all([me, other])
            db.flush()

            self.applications = {}
            for index, stage in enumerate(EXPECTED):
                job = Job(company_id=company.id, title=f"Vaga {index}", slug=f"vaga-{index}", description="Descrição da vaga.", status="approved", is_active=True, location="Curitiba")
                db.add(job)
                db.flush()
                application = Application(
                    candidate_id=me.id, job_id=job.id, stage=stage,
                    screening_status="NOT_MATCHED", screening_summary="Resumo interno", finalist_summary="Parecer interno",
                )
                db.add(application)
                db.flush()
                self.applications[stage] = (application.id, job.id)
            hidden_job = Job(company_id=company.id, title="Vaga oculta", slug="oculta", description="Descrição.", status="approved", is_active=True)
            db.add(hidden_job)
            db.flush()
            db.add(Application(candidate_id=me.id, job_id=hidden_job.id, stage="new", is_hidden=True))
            db.add(Application(candidate_id=other.id, job_id=hidden_job.id, stage="new"))
            db.commit()

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        app.include_router(candidates.router, prefix="/candidates")
        app.include_router(recruiter.router, prefix="/recruiter")
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def call(self, method: str, path: str, role: str | None = "me", **kwargs):
        headers = {"Authorization": f"Bearer {create_access_token(self.users[role].id)}"} if role else {}
        return self.client.request(method, path, headers=headers, **kwargs)

    def test_backend_mapping_is_exactly_the_agreed_one(self) -> None:
        self.assertEqual({stage.value: view for stage, view in CANDIDATE_VIEW.items()}, EXPECTED)
        self.assertEqual(set(CANDIDATE_VIEW), set(Stage))

    def test_candidate_sees_friendly_status_for_each_own_application(self) -> None:
        body = self.call("GET", "/candidates/me/applications").json()
        self.assertEqual(body["steps"], ["Recebida", "Em análise", "Entrevista", "Na etapa final"])
        by_title = {item["job_title"]: item for item in body["applications"]}
        self.assertEqual(set(by_title), {f"Vaga {index}" for index in range(len(EXPECTED))})  # hidden and other people's excluded
        for index, (stage, (label, step, outcome)) in enumerate(EXPECTED.items()):
            item = by_title[f"Vaga {index}"]
            self.assertEqual((item["status_label"], item["step"], item["outcome"]), (label, step, outcome), stage)

    def test_no_internal_details_and_no_company_name_by_default(self) -> None:
        response = self.call("GET", "/candidates/me/applications")
        text = response.text
        for internal in ("NOT_MATCHED", "Resumo interno", "Parecer interno", "finalist", "ak_interview", "Mercado Bom"):
            self.assertNotIn(internal, text)
        self.assertTrue(all(item["company_name"] is None for item in response.json()["applications"]))

    def test_company_name_shows_once_the_job_flag_is_on(self) -> None:
        _, job_id = self.applications["screening"]
        toggled = self.call("PUT", f"/recruiter/jobs/{job_id}/candidate-visibility", role="recruiter", json={"show_company_to_candidates": True})
        self.assertEqual(toggled.status_code, 200, toggled.text)
        self.assertTrue(toggled.json()["show_company_to_candidates"])

        items = {item["job_title"]: item for item in self.call("GET", "/candidates/me/applications").json()["applications"]}
        self.assertEqual(items["Vaga 1"]["company_name"], "Mercado Bom")  # screening job
        self.assertIsNone(items["Vaga 0"]["company_name"])

    def test_only_staff_toggles_company_visibility(self) -> None:
        _, job_id = self.applications["new"]
        for role in ("me", "company"):
            response = self.call("PUT", f"/recruiter/jobs/{job_id}/candidate-visibility", role=role, json={"show_company_to_candidates": True})
            self.assertEqual(response.status_code, 403, role)

    def test_only_candidates_reach_their_applications(self) -> None:
        for role in ("company", "recruiter"):
            self.assertEqual(self.call("GET", "/candidates/me/applications", role=role).status_code, 403, role)
        self.assertEqual(self.call("GET", "/candidates/me/applications", role=None).status_code, 401)

    def test_candidate_without_profile_gets_empty_list(self) -> None:
        with self.SessionLocal() as db:
            user = User(name="Novo", email="novo@example.com", hashed_password="x", role="candidate", is_active=True)
            db.add(user)
            db.commit()
            self.users["new_user"] = user
        body = self.call("GET", "/candidates/me/applications", role="new_user").json()
        self.assertEqual(body["applications"], [])


if __name__ == "__main__":
    unittest.main()
