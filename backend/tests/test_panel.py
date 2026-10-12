import unittest
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import admin, jobs, panel, recruiter
from app.core import messages
from app.core.errors import install_error_handlers
from app.core.security import create_access_token
from app.database.base import Base
from app.database.session import get_db
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.data_deletion import DataDeletionLog
from app.models.job import Job
from app.models.pipeline import ApplicationNote, ApplicationStageHistory
from app.models.screening import ScreeningAnswer, ScreeningQuestion
from app.models.user import User

NOW = datetime.now(timezone.utc)


def ago(**delta) -> datetime:
    return NOW - timedelta(**delta)


class PanelTestCase(unittest.TestCase):
    """New panel API: numbers, filters, permissions, typed notes, manual candidates, referral, LGPD erasure, team."""

    def setUp(self) -> None:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
        with self.SessionLocal() as db:
            self.users = {}
            for key, role in (("admin", "admin"), ("rita", "recruiter"), ("caio", "recruiter"), ("account", "candidate")):
                user = User(name=f"Pessoa {key}".title(), email=f"{key}@example.com", hashed_password="x", role=role, is_active=True)
                db.add(user)
                self.users[key] = user
            db.flush()
            self.company = Company(company_name="Loja Exemplo", phone="41999990000", status="approved", is_active=True)
            self.other_company = Company(company_name="Clínica Exemplo", phone="41988880000", status="approved", is_active=True)
            db.add_all([self.company, self.other_company])
            db.flush()

            def job(title, slug, status, recruiter=None, company=None, published_days=6):
                item = Job(
                    company_id=(company or self.company).id,
                    title=title,
                    slug=slug,
                    description="Descrição da vaga.",
                    location="Curitiba, PR",
                    status=status,
                    is_active=status != "closed",
                    recruiter_id=recruiter.id if recruiter else None,
                    published_at=ago(days=published_days) if status in ("approved", "closed") else None,
                )
                db.add(item)
                db.flush()
                return item

            self.rita_job = job("Atendente de loja", "atendente", "approved", self.users["rita"])
            self.caio_job = job("Recepcionista", "recepcionista", "approved", self.users["caio"], self.other_company, 12)
            self.empty_job = job("Operador de caixa", "operador", "approved", self.users["rita"], published_days=1)
            self.draft_job = job("Vendedor externo", "vendedor", "draft")
            self.archived_job = job("Estoquista", "estoquista", "archived", self.users["rita"])

            def person(name, phone, email=None, city="Curitiba", user=None):
                item = Candidate(full_name=name, phone=phone, email=email, city=city, user_id=user.id if user else None, source="site")
                db.add(item)
                db.flush()
                return item

            self.juliana = person("Juliana Prado", "41911110001", "juliana@email.com")
            self.rafael = person("Rafael Lima", "41911110002", "rafael@email.com", city="Colombo")
            self.bruna = person("Bruna Costa", "41911110003", user=self.users["account"])
            self.diego = person("Diego Alves", "41911110004")
            self.thiago = person("Thiago Ramos", "41911110005")

            def app(candidate, job_item, stage, created, updated=None, hidden=False):
                item = Application(
                    candidate_id=candidate.id,
                    job_id=job_item.id,
                    stage=stage,
                    created_at=created,
                    stage_updated_at=updated or created,
                    screening_status="REVIEW",
                    is_hidden=hidden,
                )
                db.add(item)
                db.flush()
                return item

            self.app_new_today = app(self.juliana, self.rita_job, "new", ago(hours=2))
            self.app_new_old = app(self.diego, self.rita_job, "new", ago(days=2))
            self.app_finalist_old = app(self.rafael, self.rita_job, "finalist", ago(days=10), ago(days=6))
            self.app_finalist_new = app(self.bruna, self.caio_job, "finalist", ago(days=4), ago(hours=5))
            self.app_hidden = app(self.diego, self.caio_job, "new", ago(hours=1), hidden=True)
            self.app_archived = app(self.juliana, self.archived_job, "new", ago(days=1))
            db.add(ApplicationStageHistory(application_id=self.app_finalist_old.id, from_stage="ak_interview", to_stage="finalist", changed_by_user_id=self.users["rita"].id, changed_by_role="recruiter", created_at=ago(days=6)))
            hired = app(self.thiago, self.caio_job, "hired", ago(days=20), ago(hours=3))
            db.add(ApplicationStageHistory(application_id=hired.id, from_stage="client_approved", to_stage="hired", changed_by_user_id=self.users["caio"].id, changed_by_role="recruiter", created_at=ago(hours=3)))
            db.add(ApplicationNote(application_id=hired.id, author_user_id=self.users["caio"].id, kind="entrevista", body="Boa comunicação.", created_at=ago(hours=4)))
            question = ScreeningQuestion(job_id=self.rita_job.id, key="cnh", label="Tem CNH?", question_type="YES_NO", sort_order=1)
            db.add(question)
            db.flush()
            db.add(ScreeningAnswer(application_id=self.app_new_today.id, question_id=question.id, value_bool=True))
            db.commit()

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        api = FastAPI()
        install_error_handlers(api)
        for module, prefix in ((admin, "/admin"), (jobs, "/jobs"), (panel, "/panel"), (recruiter, "/recruiter")):
            api.include_router(module.router, prefix=prefix)
        api.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(api)

    def call(self, method: str, path: str, who: str = "admin", **kwargs):
        headers = {"Authorization": f"Bearer {create_access_token(self.users[who].id)}"}
        return self.client.request(method, path, headers=headers, **kwargs)

    # --- overview ---------------------------------------------------------------------------------------------------

    def test_overview_cards_stages_activity_for_the_admin(self) -> None:
        body = self.call("GET", "/panel/overview").json()
        self.assertEqual(body["scope"], "all")
        self.assertEqual(body["alert_days"], 5)
        self.assertEqual(
            body["cards"],
            {
                # Hidden applications and archived jobs never count.
                "to_triage": 2,
                "to_triage_last_24h": 1,
                "waiting_client": 2,
                "waiting_client_too_long": 1,
                "jobs_without_candidates": 1,
                "hires_this_month": 1,
                "jobs_in_progress": 3,
            },
        )
        stages = {row["stage"]: row["count"] for row in body["stage_counts"]}
        self.assertEqual(stages, {"new": 2, "screening": 0, "ak_interview": 0, "finalist": 2, "client_approved": 0, "hired": 1})
        self.assertEqual(body["stage_counts"][3]["label"], "Enviado ao cliente")
        self.assertEqual(body["jobs_summary"], {"approved": 3, "draft": 1, "closed": 0, "archived": 1, "active_companies": 2})
        kinds = [item["kind"] for item in body["activity"]]
        self.assertIn("new_application", kinds)
        self.assertIn("hired", kinds)
        self.assertIn("job_published", kinds)
        self.assertEqual(body["activity"][0]["detail"], "Juliana Prado · Atendente de loja")
        rows = {row["title"]: row for row in body["jobs_in_progress"]}
        self.assertEqual((rows["Atendente de loja"]["applications"], rows["Atendente de loja"]["to_triage"], rows["Atendente de loja"]["with_client"]), (3, 2, 1))
        self.assertEqual(rows["Atendente de loja"]["waiting_client_too_long"], 1)

    def test_recruiter_overview_counts_only_their_jobs(self) -> None:
        body = self.call("GET", "/panel/overview", who="rita").json()
        self.assertEqual(body["scope"], "mine")
        self.assertEqual(body["cards"]["to_triage"], 2)
        self.assertEqual(body["cards"]["waiting_client"], 1)
        self.assertEqual(body["cards"]["hires_this_month"], 0)
        self.assertEqual({row["title"] for row in body["jobs_in_progress"]}, {"Atendente de loja", "Operador de caixa"})
        self.assertNotIn("Bruna Costa · Recepcionista", [item["detail"] for item in body["activity"]])

    # --- jobs list --------------------------------------------------------------------------------------------------

    def test_jobs_list_filters_counts_and_archived(self) -> None:
        body = self.call("GET", "/panel/jobs").json()
        self.assertEqual([row["title"] for row in body["items"]], ["Operador de caixa", "Atendente de loja", "Recepcionista", "Vendedor externo"])
        self.assertEqual(body["archived_hidden"], 1)
        self.assertEqual(body["total"], 4)
        self.assertEqual(body["items"][1]["recruiter_name"], "Pessoa Rita")
        titles = lambda query, who="admin": [row["title"] for row in self.call("GET", f"/panel/jobs?{query}", who=who).json()["items"]]
        self.assertEqual(titles("status=draft"), ["Vendedor externo"])
        self.assertEqual(titles(f"company_id={self.other_company.id}"), ["Recepcionista"])
        self.assertEqual(titles(f"recruiter_id={self.users['caio'].id}"), ["Recepcionista"])
        self.assertEqual(titles("no_recruiter=true"), ["Vendedor externo"])
        self.assertEqual(titles("mine=true", who="rita"), ["Operador de caixa", "Atendente de loja"])
        self.assertIn("Estoquista", titles("include_archived=true"))
        self.assertEqual(titles("status=archived"), ["Estoquista"])
        # Recruiters see every job (they operate all of them); "mine" is just the default filter on screen.
        self.assertEqual(len(titles("", who="rita")), 4)

    def test_jobs_list_pages_of_ten(self) -> None:
        with self.SessionLocal() as db:
            for index in range(12):
                db.add(Job(company_id=self.company.id, title=f"Extra {index}", slug=f"extra-{index}", description="Descrição.", status="draft"))
            db.commit()
        first = self.call("GET", "/panel/jobs").json()
        second = self.call("GET", "/panel/jobs?page=2").json()
        self.assertEqual((len(first["items"]), first["total"], first["page_size"]), (10, 16, 10))
        self.assertEqual(len(second["items"]), 6)

    # --- permissions ------------------------------------------------------------------------------------------------

    def test_admin_only_parts_are_refused_to_recruiters_and_everything_to_candidates(self) -> None:
        for method, path, payload in (
            ("GET", "/panel/team", None),
            ("GET", f"/panel/team/{self.users['rita'].id}", None),
            ("PUT", f"/panel/team/{self.users['caio'].id}/active", {"is_active": False}),
            ("PUT", f"/panel/jobs/{self.rita_job.id}/responsible", {"recruiter_id": None}),
            ("POST", f"/panel/candidates/{self.juliana.id}/erase", {"confirmation": "Juliana Prado"}),
            ("DELETE", f"/admin/companies/{self.company.id}", None),
        ):
            with self.subTest(path=path):
                self.assertEqual(self.call(method, path, who="rita", json=payload).status_code, 403)
        for path in ("/panel/overview", "/panel/jobs", "/panel/companies", "/panel/candidates", "/panel/search?q=ju"):
            with self.subTest(path=path):
                self.assertEqual(self.call("GET", path, who="rita").status_code, 200)
                self.assertEqual(self.call("GET", path, who="account").status_code, 403)
        with self.SessionLocal() as db:
            self.assertIsNone(db.get(Candidate, self.juliana.id).anonymized_at)

    def test_only_the_admin_assigns_the_responsible_recruiter(self) -> None:
        response = self.call("PUT", f"/panel/jobs/{self.draft_job.id}/responsible", json={"recruiter_id": self.users["caio"].id})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["recruiter_name"], "Pessoa Caio")

    # --- typed notes ------------------------------------------------------------------------------------------------

    def test_opinion_and_client_answer_become_typed_notes(self) -> None:
        with self.SessionLocal() as db:
            db.get(Application, self.app_new_old.id).stage = "ak_interview"
            db.commit()
        moved = self.call("POST", f"/recruiter/applications/{self.app_new_old.id}/stage", who="rita", json={"to_stage": "finalist", "finalist_summary": "Pontual e experiente."})
        self.assertEqual(moved.status_code, 200, moved.text)
        answer = self.call("POST", f"/recruiter/applications/{self.app_new_old.id}/stage", who="rita", json={"to_stage": "client_approved", "note": "Começa dia 20."})
        self.assertEqual(answer.status_code, 200, answer.text)
        note = self.call("POST", f"/recruiter/applications/{self.app_new_old.id}/notes", who="rita", json={"body": "Ligou confirmando.", "kind": "triagem"})
        self.assertEqual((note.status_code, note.json()["kind"], note.json()["kind_label"]), (201, "triagem", "Triagem"))
        self.assertEqual(self.call("POST", f"/recruiter/applications/{self.app_new_old.id}/notes", who="rita", json={"body": "x", "kind": "fofoca"}).status_code, 422)

        detail = self.call("GET", f"/recruiter/applications/{self.app_new_old.id}", who="rita").json()
        self.assertEqual(
            [(n["kind_label"], n["body"]) for n in detail["notes"]],
            [("Triagem", "Ligou confirmando."), ("Retorno do cliente", "Resposta do cliente: aprovou. Começa dia 20."), ("Parecer", "Pontual e experiente.")],
        )
        notes = self.call("GET", f"/panel/team/{self.users['rita'].id}").json()["notes"]
        self.assertEqual(notes[0]["candidate_name"], "Diego Alves")
        self.assertEqual(notes[0]["job_title"], "Atendente de loja")

    # --- candidates -------------------------------------------------------------------------------------------------

    def test_talent_pool_filters_detail_and_latest_stage(self) -> None:
        body = self.call("GET", "/panel/candidates").json()
        self.assertEqual(body["total"], 5)
        rows = {row["name"]: row for row in body["items"]}
        self.assertEqual(rows["Rafael Lima"]["latest_stage_label"], "Enviado ao cliente")
        self.assertEqual(body["cities"], ["Colombo", "Curitiba"])
        names = lambda query: {row["name"] for row in self.call("GET", f"/panel/candidates?{query}").json()["items"]}
        self.assertEqual(names("stage=finalist"), {"Rafael Lima", "Bruna Costa"})
        self.assertEqual(names("city=colombo"), {"Rafael Lima"})
        # Hidden applications do not count (Diego's one in this job is hidden).
        self.assertEqual(names(f"job_id={self.caio_job.id}"), {"Bruna Costa", "Thiago Ramos"})
        self.assertEqual(names("q=juliana@"), {"Juliana Prado"})
        self.assertEqual(names("q=1110002"), {"Rafael Lima"})

        detail = self.call("GET", f"/panel/candidates/{self.juliana.id}").json()
        self.assertEqual(detail["source_label"], "Formulário do site")
        self.assertEqual({row["job_title"] for row in detail["applications"]}, {"Atendente de loja", "Estoquista"})

    def test_manual_registration_requires_authorization_and_records_it(self) -> None:
        payload = {"full_name": "CARLA NUNES", "phone": "(41) 98888-1234", "city": "Curitiba", "job_id": self.rita_job.id}
        refused = self.call("POST", "/panel/candidates", who="rita", json={**payload, "authorization_confirmed": False})
        self.assertEqual(refused.status_code, 422)
        self.assertEqual(refused.json()["detail"], messages.MANUAL_AUTHORIZATION_REQUIRED)

        created = self.call("POST", "/panel/candidates", who="rita", json={**payload, "authorization_confirmed": True})
        self.assertEqual(created.status_code, 201, created.text)
        body = created.json()
        self.assertEqual((body["name"], body["source_label"], body["created_by_name"]), ("Carla Nunes", "Cadastro manual pela AK", "Pessoa Rita"))
        self.assertIsNotNone(body["authorization_recorded_at"])
        self.assertEqual([(row["job_title"], row["stage"]) for row in body["applications"]], [("Atendente de loja", "new")])

        duplicate = self.call("POST", "/panel/candidates", json={**payload, "phone": "41988881234", "authorization_confirmed": True})
        self.assertEqual(duplicate.status_code, 409)

    def test_edit_candidate_keeps_contacts_unique(self) -> None:
        response = self.call("PUT", f"/panel/candidates/{self.diego.id}", json={"full_name": "Diego Alves", "phone": "41911110004", "city": "Araucária", "linkedin_url": "linkedin.com/in/diego"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual((response.json()["city"], response.json()["linkedin_url"]), ("Araucária", "https://linkedin.com/in/diego"))
        taken = self.call("PUT", f"/panel/candidates/{self.diego.id}", json={"full_name": "Diego Alves", "phone": "41911110001", "city": "Curitiba"})
        self.assertEqual(taken.status_code, 409)

    def test_refer_to_another_job_keeps_the_current_application(self) -> None:
        response = self.call("POST", f"/panel/applications/{self.app_finalist_old.id}/refer", who="rita", json={"job_id": self.empty_job.id})
        self.assertEqual(response.status_code, 201, response.text)
        with self.SessionLocal() as db:
            original = db.get(Application, self.app_finalist_old.id)
            new = db.get(Application, response.json()["application_id"])
            self.assertEqual(original.stage, "finalist")
            self.assertEqual((new.job_id, new.stage), (self.empty_job.id, "new"))
            self.assertEqual(new.stage_history[0].note, "Indicado a partir da vaga Atendente de loja.")
            self.assertEqual([(n.kind, n.body) for n in new.notes], [("anotacao", "Indicado a partir da vaga Atendente de loja.")])
        again = self.call("POST", f"/panel/applications/{self.app_finalist_old.id}/refer", json={"job_id": self.empty_job.id})
        self.assertEqual(again.status_code, 409)
        same = self.call("POST", f"/panel/applications/{self.app_finalist_old.id}/refer", json={"job_id": self.rita_job.id})
        self.assertEqual(same.status_code, 422)
        archived = self.call("POST", f"/panel/applications/{self.app_finalist_old.id}/refer", json={"job_id": self.archived_job.id})
        self.assertEqual(archived.status_code, 422)

    # --- LGPD -------------------------------------------------------------------------------------------------------

    def test_erasure_needs_the_name_and_removes_personal_data_but_keeps_numbers(self) -> None:
        wrong = self.call("POST", f"/panel/candidates/{self.juliana.id}/erase", json={"confirmation": "Juliana"})
        self.assertEqual(wrong.status_code, 422)
        self.assertEqual(wrong.json()["detail"], messages.ERASURE_CONFIRMATION_MISMATCH)
        with self.SessionLocal() as db:
            db.add(ApplicationNote(application_id=self.app_new_today.id, author_user_id=self.users["rita"].id, kind="triagem", body="Mora no Centro, telefone 41911110001."))
            db.get(Application, self.app_new_today.id).cover_letter = "Sou a Juliana."
            db.get(Candidate, self.juliana.id).resume_url = "https://drive.google.com/curriculo"
            db.commit()

        response = self.call("POST", f"/panel/candidates/{self.juliana.id}/erase", json={"confirmation": " juliana prado "})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"candidate_id": self.juliana.id, "applications_count": 2, "files_deleted": 0})
        with self.SessionLocal() as db:
            candidate = db.get(Candidate, self.juliana.id)
            self.assertEqual(candidate.full_name, "Candidato removido")
            self.assertTrue(all(getattr(candidate, field) is None for field in ("email", "phone", "city", "resume_url")))
            self.assertIsNotNone(candidate.anonymized_at)
            application = db.get(Application, self.app_new_today.id)
            self.assertIsNone(application.cover_letter)
            self.assertEqual(db.query(ScreeningAnswer).filter(ScreeningAnswer.application_id == application.id).count(), 0)
            self.assertTrue(all(note.body == "Conteúdo removido a pedido do candidato (LGPD)." for note in application.notes))
            # Numbers stay: the applications and their stages are still there.
            self.assertEqual(db.query(Application).filter(Application.candidate_id == candidate.id).count(), 2)
            log = db.query(DataDeletionLog).one()
            self.assertEqual((log.candidate_id, log.performed_by_user_id, log.applications_count), (candidate.id, self.users["admin"].id, 2))
            self.assertEqual({column.name for column in DataDeletionLog.__table__.columns}, {"id", "candidate_id", "performed_by_user_id", "applications_count", "files_deleted", "performed_at"})
        self.assertNotIn("Candidato removido", {row["name"] for row in self.call("GET", "/panel/candidates").json()["items"]})
        self.assertEqual(self.call("GET", f"/panel/candidates/{self.juliana.id}").status_code, 404)
        self.assertEqual(self.call("GET", "/panel/overview").json()["cards"]["to_triage"], 2)
        self.assertEqual(self.call("POST", f"/panel/candidates/{self.juliana.id}/erase", json={"confirmation": "Candidato removido"}).status_code, 404)

    def test_erasure_of_an_account_holder_closes_and_frees_the_account(self) -> None:
        self.call("POST", f"/panel/candidates/{self.bruna.id}/erase", json={"confirmation": "Bruna Costa"})
        with self.SessionLocal() as db:
            user = db.get(User, self.users["account"].id)
            self.assertFalse(user.is_active)
            self.assertIsNone(user.hashed_password)
            self.assertEqual(user.email, f"removido-{user.id}@anonimizado.invalid")
        self.assertEqual(self.call("GET", "/panel/overview", who="account").status_code, 403)

    # --- team -------------------------------------------------------------------------------------------------------

    def test_team_list_and_member_page(self) -> None:
        rows = {row["name"]: row for row in self.call("GET", "/panel/team").json()}
        self.assertEqual(rows["Pessoa Rita"]["role_label"], "Recrutadora")
        self.assertEqual(rows["Pessoa Admin"]["role_label"], "Administradora")
        self.assertEqual((rows["Pessoa Rita"]["active_jobs"], rows["Pessoa Rita"]["candidates_in_progress"]), (2, 3))
        self.assertEqual((rows["Pessoa Caio"]["hires_this_month"], rows["Pessoa Caio"]["last_activity_at"] is not None), (1, True))

        detail = self.call("GET", f"/panel/team/{self.users['caio'].id}").json()
        self.assertEqual(detail["cards"]["hires_this_month"], 1)
        self.assertEqual(detail["cards"]["average_days_to_hire"], 11.9)
        self.assertEqual(detail["jobs"][0]["stage_counts"]["finalist"], 1)
        self.assertEqual([(n["kind_label"], n["candidate_name"]) for n in detail["notes"]], [("Entrevista", "Thiago Ramos")])

    def test_edit_and_deactivate_team_members(self) -> None:
        edited = self.call("PUT", f"/panel/team/{self.users['caio'].id}", json={"name": "Caio Souza", "email": "CAIO.SOUZA@aktalent.com.br"})
        self.assertEqual((edited.status_code, edited.json()["email"]), (200, "caio.souza@aktalent.com.br"))
        self.assertEqual(self.call("PUT", f"/panel/team/{self.users['caio'].id}", json={"name": "Caio", "email": "rita@example.com"}).status_code, 409)
        self.assertEqual(self.call("PUT", f"/panel/team/{self.users['admin'].id}/active", json={"is_active": False}).status_code, 422)
        off = self.call("PUT", f"/panel/team/{self.users['caio'].id}/active", json={"is_active": False})
        self.assertFalse(off.json()["is_active"])
        self.assertEqual(self.call("GET", "/panel/overview", who="caio").status_code, 403)

    # --- companies, dates, search -----------------------------------------------------------------------------------

    def test_company_deleted_only_without_jobs(self) -> None:
        with self.SessionLocal() as db:
            lonely = Company(company_name="Sem Vagas", phone="41977770000", status="approved", is_active=True)
            db.add(lonely)
            db.commit()
            lonely_id = lonely.id
        blocked = self.call("DELETE", f"/admin/companies/{self.company.id}")
        self.assertEqual((blocked.status_code, blocked.json()["detail"]), (409, messages.COMPANY_HAS_JOBS))
        self.assertEqual(self.call("DELETE", f"/admin/companies/{lonely_id}").status_code, 204)
        names = {row["company_name"] for row in self.call("GET", "/panel/companies", who="rita").json()}
        self.assertEqual(names, {"Loja Exemplo", "Clínica Exemplo"})

    def test_publish_and_close_dates_are_recorded(self) -> None:
        self.call("PUT", f"/admin/jobs/{self.draft_job.id}/approve")
        self.call("PUT", f"/admin/jobs/{self.caio_job.id}/hide")
        with self.SessionLocal() as db:
            self.assertIsNotNone(db.get(Job, self.draft_job.id).published_at)
            self.assertIsNotNone(db.get(Job, self.caio_job.id).closed_at)
        self.assertEqual(self.call("GET", f"/panel/team/{self.users['caio'].id}").json()["cards"]["closed_this_month"], 1)

    def test_search_candidates_jobs_and_companies(self) -> None:
        body = self.call("GET", "/panel/search?q=exemplo").json()
        self.assertEqual({hit["title"] for hit in body["companies"]}, {"Loja Exemplo", "Clínica Exemplo"})
        self.assertEqual([hit["title"] for hit in self.call("GET", "/panel/search?q=recep").json()["jobs"]], ["Recepcionista"])
        self.assertEqual([hit["title"] for hit in self.call("GET", "/panel/search?q=rafael").json()["candidates"]], ["Rafael Lima"])
        self.assertEqual(self.call("GET", "/panel/search?q=a").json(), {"candidates": [], "jobs": [], "companies": []})


if __name__ == "__main__":
    unittest.main()
