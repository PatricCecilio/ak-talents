import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import applications, jobs, public, recruiter
from app.core.pipeline import AK_TRANSITIONS, FILLED_JOB_NOTE, Stage
from app.core.rate_limit import limiter
from app.core.security import create_access_token
from app.database.base import Base
from app.database.session import get_db
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.pipeline import ApplicationNote, ApplicationStageHistory
from app.models.user import User


class PipelineTestCase(unittest.TestCase):
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
            company = Company(user_id=self.users["company"].id, company_name="Empresa", status="approved")
            db.add(company)
            db.flush()
            self.job = Job(company_id=company.id, title="Atendente", slug="atendente", description="Atendimento ao público.", status="approved", is_active=True)
            db.add(self.job)
            db.flush()
            db.add(Candidate(user_id=self.users["candidate"].id, full_name="Pessoa candidate"))
            db.commit()

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        app.include_router(recruiter.router, prefix="/recruiter")
        app.include_router(jobs.router, prefix="/jobs")
        app.include_router(applications.router, prefix="/applications")
        app.include_router(public.router, prefix="/public")
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self) -> None:
        limiter.reset()

    def headers(self, role: str) -> dict:
        return {"Authorization": f"Bearer {create_access_token(self.users[role].id)}"}

    def make_application(self, stage: str = "new", name: str = "Maria", hidden: bool = False) -> int:
        with self.SessionLocal() as db:
            candidate = Candidate(full_name=name, email=f"{name.lower()}@example.com", phone="41999990000")
            db.add(candidate)
            db.flush()
            application = Application(candidate_id=candidate.id, job_id=self.job.id, stage=stage, is_hidden=hidden)
            db.add(application)
            db.commit()
            return application.id

    def move(self, application_id: int, to_stage: str, role: str = "recruiter", **extra):
        return self.client.post(
            f"/recruiter/applications/{application_id}/stage",
            json={"to_stage": to_stage, **extra},
            headers=self.headers(role),
        )

    def history(self, application_id: int) -> list[ApplicationStageHistory]:
        with self.SessionLocal() as db:
            return (
                db.query(ApplicationStageHistory)
                .filter(ApplicationStageHistory.application_id == application_id)
                .order_by(ApplicationStageHistory.id)
                .all()
            )

    def stage_of(self, application_id: int) -> str:
        with self.SessionLocal() as db:
            return db.get(Application, application_id).stage

    # --- transitions ---

    def test_every_allowed_ak_transition_works_and_is_recorded(self) -> None:
        for from_stage, targets in AK_TRANSITIONS.items():
            for to_stage in targets:
                application_id = self.make_application(from_stage.value)
                extra = {"finalist_summary": "Boa comunicação."} if to_stage == Stage.finalist else {}
                response = self.move(application_id, to_stage.value, note="ok", **extra)
                self.assertEqual(response.status_code, 200, f"{from_stage.value}->{to_stage.value}: {response.text}")
                entry = self.history(application_id)[-1]
                self.assertEqual((entry.from_stage, entry.to_stage), (from_stage.value, to_stage.value))
                self.assertEqual(entry.changed_by_user_id, self.users["recruiter"].id)
                self.assertEqual(entry.changed_by_role, "recruiter")
                self.assertEqual(entry.note, "ok")

    def test_forbidden_transitions_are_refused(self) -> None:
        cases = [
            ("new", "finalist"),
            ("new", "hired"),
            ("screening", "client_approved"),
            ("hired", "rejected"),
            # Finalist -> client decision belongs to the company, not the AK team.
            ("finalist", "client_approved"),
            ("finalist", "rejected"),
        ]
        for from_stage, to_stage in cases:
            application_id = self.make_application(from_stage)
            response = self.move(application_id, to_stage, finalist_summary="x")
            self.assertEqual(response.status_code, 409, f"{from_stage}->{to_stage}")
            self.assertIn("Não é possível mover", response.json()["detail"])
            self.assertEqual(self.stage_of(application_id), from_stage)
            self.assertEqual(self.history(application_id), [])

    def test_invalid_stage_name(self) -> None:
        response = self.move(self.make_application(), "promovido")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"], "Etapa inválida.")

    def test_finalist_requires_a_summary_for_the_client(self) -> None:
        application_id = self.make_application("ak_interview")
        response = self.move(application_id, "finalist", finalist_summary="   ")
        self.assertEqual(response.status_code, 422)
        self.assertIn("parecer", response.json()["detail"])

        ok = self.move(application_id, "finalist", finalist_summary="Experiência sólida em atendimento.")
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()["stage_label"], "Finalista (enviado ao cliente)")
        self.assertEqual({option["value"] for option in ok.json()["allowed_next_stages"]}, {"ak_interview", "withdrawn"})
        with self.SessionLocal() as db:
            self.assertEqual(db.get(Application, application_id).finalist_summary, "Experiência sólida em atendimento.")

    def test_hired_can_close_other_active_candidates_with_history(self) -> None:
        hired = self.make_application("client_approved", "Ana")
        active_new = self.make_application("new", "Bia")
        active_finalist = self.make_application("finalist", "Caio")
        already_rejected = self.make_application("rejected", "Duda")
        hidden_active = self.make_application("screening", "Eva", hidden=True)

        response = self.move(hired, "hired", close_other_active=True)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["closed_others_count"], 2)

        for application_id in (active_new, active_finalist):
            self.assertEqual(self.stage_of(application_id), "rejected")
            entry = self.history(application_id)[-1]
            self.assertEqual(entry.note, FILLED_JOB_NOTE)
            self.assertEqual(entry.changed_by_user_id, self.users["recruiter"].id)
        self.assertEqual(self.stage_of(already_rejected), "rejected")
        self.assertEqual(self.history(already_rejected), [])
        self.assertEqual(self.stage_of(hidden_active), "screening")

    def test_close_other_active_only_when_hiring(self) -> None:
        response = self.move(self.make_application("new"), "rejected", close_other_active=True)
        self.assertEqual(response.status_code, 422)

    # --- notes ---

    def test_internal_notes(self) -> None:
        application_id = self.make_application()
        created = self.client.post(f"/recruiter/applications/{application_id}/notes", json={"body": " Ligar amanhã. "}, headers=self.headers("admin"))
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["body"], "Ligar amanhã.")
        self.assertEqual(created.json()["author_name"], "Pessoa admin")

        empty = self.client.post(f"/recruiter/applications/{application_id}/notes", json={"body": "  "}, headers=self.headers("recruiter"))
        self.assertEqual(empty.status_code, 422)

    # --- who may call these routes ---

    def test_company_candidate_and_anonymous_cannot_operate_the_pipeline(self) -> None:
        application_id = self.make_application("ak_interview")
        for role in ("company", "candidate"):
            self.assertEqual(self.move(application_id, "screening", role=role).status_code, 403, role)
            note = self.client.post(f"/recruiter/applications/{application_id}/notes", json={"body": "x"}, headers=self.headers(role))
            self.assertEqual(note.status_code, 403, role)
        self.assertEqual(self.client.post(f"/recruiter/applications/{application_id}/stage", json={"to_stage": "screening"}).status_code, 401)
        self.assertEqual(self.stage_of(application_id), "ak_interview")
        with self.SessionLocal() as db:
            self.assertEqual(db.query(ApplicationNote).count(), 0)

    def test_unknown_application_is_not_found(self) -> None:
        self.assertEqual(self.move(9999, "screening").status_code, 404)

    # --- entry points ---

    def test_public_application_starts_new_and_screening_hands_it_to_ak(self) -> None:
        response = self.client.post(
            "/jobs/atendente/applications",
            json={"full_name": "Júlia", "email": "julia@example.com", "phone": "41988887777", "city": "Curitiba", "neighborhood": "Centro", "privacy_accepted": True},
        )
        self.assertEqual(response.status_code, 201, response.text)
        with self.SessionLocal() as db:
            application = db.query(Application).one()
        self.assertEqual(application.stage, "new")
        first = self.history(application.id)
        self.assertEqual([(entry.from_stage, entry.to_stage, entry.changed_by_role) for entry in first], [(None, "new", "system")])

        # No screening questions on this job: submitting completes the screening (REVIEW).
        token = response.json()["public_screening_token"]
        self.assertEqual(self.client.post(f"/public/applications/{token}/screening", json={"answers": []}).status_code, 200)
        self.assertEqual(self.stage_of(application.id), "screening")
        last = self.history(application.id)[-1]
        self.assertEqual((last.from_stage, last.to_stage, last.changed_by_role), ("new", "screening", "system"))
        self.assertEqual(last.note, "Triagem automática concluída: para análise da equipe.")

    def test_account_application_goes_straight_to_ak_review(self) -> None:
        response = self.client.post("/applications", json={"job_id": self.job.id}, headers=self.headers("candidate"))
        self.assertEqual(response.status_code, 201, response.text)
        with self.SessionLocal() as db:
            application = db.query(Application).one()
        self.assertEqual(application.stage, "new")
        self.assertEqual(application.screening_status, "REVIEW")
        self.assertIn("Sem triagem automática", application.screening_summary)
        self.assertEqual(self.history(application.id)[0].note, "Candidatura com conta.")


if __name__ == "__main__":
    unittest.main()
