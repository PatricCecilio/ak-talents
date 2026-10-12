import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import admin, applications, candidates, jobs, recruiter
from app.core import messages
from app.core.errors import install_error_handlers
from app.core.security import create_access_token
from app.database.base import Base
from app.database.session import get_db
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.pipeline import ApplicationStageHistory
from app.models.screening import ScreeningQuestion
from app.models.user import User


class AdminJobDeleteArchiveTestCase(unittest.TestCase):
    """Delete only jobs nobody applied to; otherwise archive (out of every list, history kept). Admin only."""

    def setUp(self) -> None:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
        with self.SessionLocal() as db:
            self.users = {}
            for key, role in (("admin", "admin"), ("recruiter", "recruiter"), ("candidate", "candidate")):
                user = User(name=f"Pessoa {key}", email=f"{key}@example.com", hashed_password="x", role=role, is_active=True)
                db.add(user)
                self.users[key] = user
            company = Company(company_name="Cliente", phone="41999990000", status="approved", is_active=True)
            db.add(company)
            db.flush()
            self.empty_job = Job(company_id=company.id, title="Vaga vazia", slug="vaga-vazia", description="Sem candidatos ainda.", status="approved")
            self.busy_job = Job(company_id=company.id, title="Vaga com gente", slug="vaga-com-gente", description="Já tem candidatos.", status="approved")
            db.add_all([self.empty_job, self.busy_job])
            db.flush()
            db.add(ScreeningQuestion(job_id=self.empty_job.id, key="cnh", label="Tem CNH?", question_type="YES_NO", sort_order=1))
            candidate = Candidate(full_name="Bruno")
            db.add(candidate)
            db.flush()
            # Hidden: still counts (a job with any application is never deleted).
            application = Application(candidate_id=candidate.id, job_id=self.busy_job.id, stage="screening", is_hidden=True)
            db.add(application)
            db.flush()
            db.add(ApplicationStageHistory(application_id=application.id, from_stage="new", to_stage="screening", changed_by_role="system"))
            # A candidate with an account who applied before the job was archived.
            account_candidate = Candidate(user_id=self.users["candidate"].id, full_name="Carla Conta")
            db.add(account_candidate)
            db.flush()
            db.add(Application(candidate_id=account_candidate.id, job_id=self.busy_job.id, stage="ak_interview"))
            db.commit()
            self.application_id = application.id

        # The recruiter here is responsible for every job (a recruiter only sees their own jobs).
        with self.SessionLocal() as db:
            db.query(Job).update({Job.recruiter_id: self.users["recruiter"].id})
            db.commit()

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        install_error_handlers(app)
        for module, prefix in ((admin, "/admin"), (applications, "/applications"), (candidates, "/candidates"), (jobs, "/jobs"), (recruiter, "/recruiter")):
            app.include_router(module.router, prefix=prefix)
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def call(self, method: str, path: str, role: str = "admin", **kwargs):
        headers = {"Authorization": f"Bearer {create_access_token(self.users[role].id)}"}
        return self.client.request(method, path, headers=headers, **kwargs)

    def admin_job_ids(self, include_archived: bool = False) -> set[int]:
        suffix = "?include_archived=true" if include_archived else ""
        return {job["id"] for job in self.call("GET", f"/admin/jobs{suffix}").json()}

    def test_job_without_applications_is_really_deleted(self) -> None:
        listed = {job["id"]: job["applications_count"] for job in self.call("GET", "/admin/jobs").json()}
        self.assertEqual(listed, {self.empty_job.id: 0, self.busy_job.id: 2})

        response = self.call("DELETE", f"/admin/jobs/{self.empty_job.id}")
        self.assertEqual(response.status_code, 204, response.text)
        with self.SessionLocal() as db:
            self.assertIsNone(db.get(Job, self.empty_job.id))
            self.assertEqual(db.query(ScreeningQuestion).count(), 0)
        self.assertEqual(self.call("DELETE", f"/admin/jobs/{self.empty_job.id}").status_code, 404)

    def test_api_refuses_to_delete_a_job_with_applications(self) -> None:
        response = self.call("DELETE", f"/admin/jobs/{self.busy_job.id}")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"], messages.JOB_HAS_APPLICATIONS)
        with self.SessionLocal() as db:
            self.assertIsNotNone(db.get(Job, self.busy_job.id))
            self.assertIsNotNone(db.get(Application, self.application_id))

    def test_archive_hides_the_job_everywhere_and_keeps_the_history(self) -> None:
        response = self.call("PUT", f"/admin/jobs/{self.busy_job.id}/archived", json={"archived": True})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "archived")

        self.assertNotIn(self.busy_job.id, self.admin_job_ids())
        self.assertIn(self.busy_job.id, self.admin_job_ids(include_archived=True))
        self.assertNotIn(self.busy_job.id, {job["id"] for job in self.call("GET", "/recruiter/jobs", role="recruiter").json()["jobs"]})
        self.assertNotIn("vaga-com-gente", {job["slug"] for job in self.client.get("/jobs").json()})
        self.assertEqual(self.client.get("/jobs/vaga-com-gente").status_code, 404)
        with self.SessionLocal() as db:
            self.assertIsNotNone(db.get(Application, self.application_id))
            self.assertEqual(db.query(ApplicationStageHistory).count(), 1)

        # Frozen while archived: no publishing or editing by mistake.
        self.assertEqual(self.call("PUT", f"/admin/jobs/{self.busy_job.id}/approve").status_code, 409)
        self.assertEqual(self.call("PUT", f"/admin/jobs/{self.busy_job.id}/approve").json()["detail"], messages.JOB_ARCHIVED)

    def test_unarchive_brings_it_back_closed(self) -> None:
        self.call("PUT", f"/admin/jobs/{self.busy_job.id}/archived", json={"archived": True})
        response = self.call("PUT", f"/admin/jobs/{self.busy_job.id}/archived", json={"archived": False})
        self.assertEqual(response.json()["status"], "closed")
        self.assertIn(self.busy_job.id, self.admin_job_ids())
        self.assertIn(self.busy_job.id, {job["id"] for job in self.call("GET", "/recruiter/jobs", role="recruiter").json()["jobs"]})
        # Off the site until the admin publishes it again.
        self.assertNotIn("vaga-com-gente", {job["slug"] for job in self.client.get("/jobs").json()})
        self.assertEqual(self.call("PUT", f"/admin/jobs/{self.busy_job.id}/approve").status_code, 200)
        self.assertIn("vaga-com-gente", {job["slug"] for job in self.client.get("/jobs").json()})

    def test_archived_or_closed_job_link_is_unavailable_and_refuses_applications(self) -> None:
        public_form = {"full_name": "Nova Pessoa", "email": "nova@example.com", "phone": "41988887777", "city": "Curitiba", "privacy_accepted": True}
        for label, change in (
            ("arquivada", lambda: self.call("PUT", f"/admin/jobs/{self.empty_job.id}/archived", json={"archived": True})),
            ("encerrada", lambda: self.call("PUT", f"/admin/jobs/{self.empty_job.id}/hide")),
        ):
            with self.subTest(status=label):
                self.call("PUT", f"/admin/jobs/{self.empty_job.id}/archived", json={"archived": False})
                self.call("PUT", f"/admin/jobs/{self.empty_job.id}/approve")
                self.assertEqual(self.client.get("/jobs/vaga-vazia").status_code, 200)
                self.assertEqual(change().status_code, 200)

                # The job link (and the WhatsApp preview, which reads this same endpoint) gets nothing.
                detail = self.client.get("/jobs/vaga-vazia")
                self.assertEqual(detail.status_code, 404)
                self.assertEqual(detail.json(), {"detail": messages.JOB_NOT_FOUND})
                # Public form and logged-in application both refused.
                public = self.client.post("/jobs/vaga-vazia/applications", json=public_form)
                self.assertEqual(public.status_code, 404)
                self.assertEqual(public.json()["detail"], messages.JOB_NOT_FOUND)
                logged_in = self.call("POST", "/applications", role="candidate", json={"job_id": self.empty_job.id})
                self.assertEqual(logged_in.status_code, 404)
                with self.SessionLocal() as db:
                    self.assertEqual(db.query(Application).filter(Application.job_id == self.empty_job.id).count(), 0)

    def test_candidate_still_sees_the_application_of_an_archived_job(self) -> None:
        self.call("PUT", f"/admin/jobs/{self.busy_job.id}/archived", json={"archived": True})
        response = self.call("GET", "/candidates/me/applications", role="candidate")
        self.assertEqual(response.status_code, 200, response.text)
        items = response.json()["applications"]
        self.assertEqual([item["job_title"] for item in items], ["Vaga com gente"])
        self.assertEqual(items[0]["status_label"], "Entrevista")

    def test_only_the_admin_deletes_or_archives(self) -> None:
        self.assertEqual(self.call("DELETE", f"/admin/jobs/{self.empty_job.id}", role="recruiter").status_code, 403)
        self.assertEqual(self.call("PUT", f"/admin/jobs/{self.busy_job.id}/archived", role="recruiter", json={"archived": True}).status_code, 403)
        self.assertEqual(self.client.delete(f"/admin/jobs/{self.empty_job.id}").status_code, 401)
        with self.SessionLocal() as db:
            self.assertEqual(db.query(Job).count(), 2)
            self.assertEqual({job.status for job in db.query(Job)}, {"approved"})


if __name__ == "__main__":
    unittest.main()
