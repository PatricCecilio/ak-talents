import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import recruiter
from app.core.config import settings
from app.core.security import create_access_token
from app.database.base import Base
from app.database.session import get_db
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.pipeline import ApplicationNote, ApplicationStageHistory
from app.models.screening import ScreeningAnswer, ScreeningQuestion
from app.models.user import User

NOW = datetime.now(timezone.utc)


class RecruiterAreaTestCase(unittest.TestCase):
    def setUp(self) -> None:
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
            company = Company(user_id=self.users["company"].id, company_name="Mercado Bom", status="approved")
            db.add(company)
            db.flush()
            self.job = Job(company_id=company.id, title="Caixa", slug="caixa", description="Operar o caixa.", status="approved", is_active=True, recruiter_id=self.users["recruiter"].id)
            self.other_job = Job(company_id=company.id, title="Repositor", slug="repositor", description="Repor gôndolas.", status="pending", is_active=True)
            db.add_all([self.job, self.other_job])
            db.flush()

            def application(name: str, stage: str, updated_days_ago: float = 0, hidden: bool = False, job: Job = self.job) -> Application:
                candidate = Candidate(full_name=name, email=f"{name.lower()}@example.com", phone="41999990000", city="Curitiba", neighborhood="Centro")
                db.add(candidate)
                db.flush()
                item = Application(candidate_id=candidate.id, job_id=job.id, stage=stage, is_hidden=hidden, stage_updated_at=NOW - timedelta(days=updated_days_ago))
                db.add(item)
                db.flush()
                return item

            self.new = application("Ana", "new")
            self.screening = application("Bruno", "screening")
            self.old_finalist = application("Carla", "finalist", updated_days_ago=5)
            self.recent_finalist = application("Davi", "finalist", updated_days_ago=1)
            self.rejected = application("Elisa", "rejected")
            self.hidden = application("Fábio", "screening", hidden=True)
            application("Gil", "new", job=self.other_job)

            yes_no = ScreeningQuestion(job_id=self.job.id, key="weekend", label="Pode trabalhar aos sábados?", question_type="YES_NO", sort_order=1)
            select = ScreeningQuestion(
                job_id=self.job.id, key="shift", label="Qual turno prefere?", question_type="SINGLE_SELECT", sort_order=2,
                options=[{"value": "morning", "label": "Manhã"}, {"value": "night", "label": "Noite"}],
            )
            db.add_all([yes_no, select])
            db.flush()
            db.add_all([
                ScreeningAnswer(application_id=self.screening.id, question_id=yes_no.id, value_bool=False),
                ScreeningAnswer(application_id=self.screening.id, question_id=select.id, value_select="morning"),
            ])
            self.screening.screening_status = "QUALIFIED"
            self.screening.screening_score = 100
            db.add_all([
                ApplicationStageHistory(application_id=self.screening.id, from_stage=None, to_stage="new", changed_by_role="system", created_at=NOW - timedelta(days=2)),
                ApplicationStageHistory(application_id=self.screening.id, from_stage="new", to_stage="screening", changed_by_role="recruiter", changed_by_user_id=self.users["recruiter"].id, note="Perfil bom", created_at=NOW - timedelta(days=1)),
                ApplicationNote(application_id=self.screening.id, author_user_id=self.users["admin"].id, body="Primeira nota", created_at=NOW - timedelta(hours=5)),
                ApplicationNote(application_id=self.screening.id, author_user_id=self.users["recruiter"].id, body="Segunda nota", created_at=NOW - timedelta(hours=1)),
            ])
            db.commit()

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        app.include_router(recruiter.router, prefix="/recruiter")
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def get(self, path: str, role: str | None = "recruiter"):
        headers = {"Authorization": f"Bearer {create_access_token(self.users[role].id)}"} if role else {}
        return self.client.get(path, headers=headers)

    def test_jobs_list_counts_by_stage_without_hidden(self) -> None:
        response = self.get("/recruiter/jobs")
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["finalist_alert_days"], 3)

        job = next(item for item in body["jobs"] if item["id"] == self.job.id)
        self.assertEqual(job["company_name"], "Mercado Bom")
        self.assertEqual(job["recruiter_name"], "Pessoa recruiter")
        self.assertEqual(job["stage_counts"]["new"], 1)
        self.assertEqual(job["stage_counts"]["screening"], 1)  # the hidden one is not counted
        self.assertEqual(job["stage_counts"]["finalist"], 2)
        self.assertEqual(job["stage_counts"]["rejected"], 1)
        self.assertEqual(job["stage_counts"]["hired"], 0)
        self.assertEqual(job["active_count"], 4)
        self.assertEqual(job["finalists_waiting"], 1)

    def test_finalist_alert_days_is_configurable(self) -> None:
        with mock.patch.object(settings, "FINALIST_ALERT_DAYS", 0):
            job = next(item for item in self.get("/recruiter/jobs").json()["jobs"] if item["id"] == self.job.id)
        self.assertEqual(job["finalists_waiting"], 2)

    def test_job_pipeline_lists_visible_cards_and_filters_by_stage(self) -> None:
        body = self.get(f"/recruiter/jobs/{self.job.id}/applications").json()
        names = {card["candidate_name"] for card in body["applications"]}
        self.assertEqual(names, {"Ana", "Bruno", "Carla", "Davi", "Elisa"})

        finalists = self.get(f"/recruiter/jobs/{self.job.id}/applications?stage=finalist").json()["applications"]
        waiting = {card["candidate_name"]: card["waiting_client_too_long"] for card in finalists}
        self.assertEqual(waiting, {"Carla": True, "Davi": False})
        self.assertEqual({option["value"] for option in finalists[0]["allowed_next_stages"]}, {"ak_interview", "withdrawn"})

    def test_application_detail_has_everything_the_recruiter_needs(self) -> None:
        detail = self.get(f"/recruiter/applications/{self.screening.id}").json()
        self.assertEqual(detail["candidate"]["name"], "Bruno")
        self.assertEqual(detail["candidate"]["phone"], "41999990000")
        self.assertEqual(detail["company_name"], "Mercado Bom")
        self.assertEqual(detail["stage_label"], "Em triagem")
        self.assertEqual(detail["screening"]["status"], "QUALIFIED")
        self.assertEqual(
            detail["screening"]["answers"],
            [
                {"question": "Pode trabalhar aos sábados?", "answer": "Não"},
                {"question": "Qual turno prefere?", "answer": "Manhã"},
            ],
        )
        self.assertEqual([(entry["from_stage_label"], entry["to_stage_label"]) for entry in detail["history"]], [(None, "Nova"), ("Nova", "Em triagem")])
        self.assertEqual(detail["history"][1]["changed_by_name"], "Pessoa recruiter")
        self.assertEqual([note["body"] for note in detail["notes"]], ["Segunda nota", "Primeira nota"])
        self.assertEqual({option["value"] for option in detail["allowed_next_stages"]}, {"ak_interview", "rejected", "withdrawn"})
        self.assertEqual(detail["other_active_count"], 3)  # Ana, Carla, Davi (not hidden, not rejected)

    def test_admin_also_uses_the_recruiter_area(self) -> None:
        self.assertEqual(self.get("/recruiter/jobs", role="admin").status_code, 200)
        self.assertEqual(self.get(f"/recruiter/applications/{self.new.id}", role="admin").status_code, 200)

    def test_company_candidate_and_anonymous_are_kept_out(self) -> None:
        paths = ["/recruiter/jobs", f"/recruiter/jobs/{self.job.id}/applications", f"/recruiter/applications/{self.screening.id}"]
        for path in paths:
            for role in ("company", "candidate"):
                self.assertEqual(self.get(path, role=role).status_code, 403, f"{role} {path}")
            self.assertEqual(self.get(path, role=None).status_code, 401, path)

    def test_unknown_job_or_application(self) -> None:
        self.assertEqual(self.get("/recruiter/jobs/999/applications").status_code, 404)
        self.assertEqual(self.get("/recruiter/applications/999").status_code, 404)


if __name__ == "__main__":
    unittest.main()
