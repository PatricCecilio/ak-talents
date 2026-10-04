import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.api.routes import admin, applications, integrations, jobs, public
from app.core.config import settings
from app.core.rate_limit import limiter
from app.database.base import Base
from app.database.session import get_db
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.screening import ScreeningQuestion
from app.models.user import User
from app.schemas.screening import ScreeningQuestionCreate
from app.services.screening_service import replace_admin_screening_questions
from app.services.slug_service import generate_unique_job_slug, slugify


class PublicJobsTestCase(unittest.TestCase):
    def setUp(self) -> None:
        # Rate-limit counters are process-wide; start every test from zero.
        limiter.reset()
        self.original_appintelli_secret = settings.APPINTELLI_INTEGRATION_SECRET
        settings.APPINTELLI_INTEGRATION_SECRET = "test-appintelli-secret"
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine, expire_on_commit=False)
        Base.metadata.create_all(bind=self.engine)

        app = FastAPI()
        app.include_router(jobs.router, prefix="/jobs")
        app.include_router(applications.router, prefix="/applications")
        app.include_router(admin.router, prefix="/admin")
        app.include_router(public.router, prefix="/public")
        app.include_router(integrations.router, prefix="/integrations")

        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: self.admin_user
        self.client = TestClient(app)

        with self.SessionLocal() as db:
            self.admin_user = User(
                name="Admin Teste",
                email="admin@example.com",
                hashed_password="hash",
                role="admin",
            )
            db.add(self.admin_user)
            db.flush()
            user = User(
                name="Empresa Teste",
                email="empresa@example.com",
                hashed_password="hash",
                role="company",
            )
            db.add(user)
            db.flush()
            company = Company(user_id=user.id, company_name="Empresa Teste", status="approved")
            db.add(company)
            db.flush()
            db.add_all(
                [
                    Job(
                        company_id=company.id,
                        title="Desenvolvedor Python",
                        slug="desenvolvedor-python",
                        description="Criar APIs e sistemas internos.",
                        location="Sao Paulo",
                        work_mode="remote",
                        status="approved",
                        is_active=True,
                    ),
                    Job(
                        company_id=company.id,
                        title="Vaga Oculta",
                        slug="vaga-oculta",
                        description="Esta vaga nao deve aparecer publicamente.",
                        status="hidden",
                        is_active=False,
                    ),
                    Job(
                        company_id=company.id,
                        title="Produto Pleno",
                        slug="produto-pleno",
                        description="Atuar em produto digital.",
                        location="Sao Paulo",
                        work_mode="hybrid",
                        status="approved",
                        is_active=True,
                    ),
                    Job(
                        company_id=company.id,
                        title="Vaga Pendente",
                        slug="vaga-pendente",
                        description="Esta vaga ainda nao esta aprovada.",
                        status="pending",
                        is_active=True,
                    ),
                ]
            )
            db.commit()

    def tearDown(self) -> None:
        Base.metadata.drop_all(bind=self.engine)
        settings.APPINTELLI_INTEGRATION_SECRET = self.original_appintelli_secret

    def _integration_headers(self, secret: str = "test-appintelli-secret") -> dict[str, str]:
        return {"Authorization": f"Bearer {secret}"}

    def test_public_list_returns_only_publishable_jobs(self):
        response = self.client.get("/jobs")

        self.assertEqual(response.status_code, 200)
        slugs = [job["slug"] for job in response.json()]
        self.assertEqual(slugs, ["desenvolvedor-python", "produto-pleno"])
        self.assertNotIn("status", response.json()[0])
        self.assertNotIn("is_active", response.json()[0])
        self.assertNotIn("company_id", response.json()[0])

    def test_public_detail_by_slug_works(self):
        response = self.client.get("/jobs/desenvolvedor-python")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["slug"], "desenvolvedor-python")
        self.assertNotIn("status", response.json())
        self.assertNotIn("is_active", response.json())
        self.assertNotIn("company_id", response.json())

    def test_unknown_slug_returns_404(self):
        response = self.client.get("/jobs/nao-existe")

        self.assertEqual(response.status_code, 404)

    def test_unpublishable_job_by_slug_returns_404(self):
        hidden_response = self.client.get("/jobs/vaga-oculta")
        pending_response = self.client.get("/jobs/vaga-pendente")

        self.assertEqual(hidden_response.status_code, 404)
        self.assertEqual(pending_response.status_code, 404)

    def test_slug_generation_is_url_safe(self):
        self.assertEqual(slugify("Desenvolvedor Python Pleno/Senior"), "desenvolvedor-python-pleno-senior")

    def test_slug_collision_gets_suffix(self):
        with self.SessionLocal() as db:
            slug = generate_unique_job_slug(db, "Desenvolvedor Python")

        self.assertEqual(slug, "desenvolvedor-python-2")

    def test_existing_matches_route_still_resolves(self):
        response = self.client.get("/jobs/1/matches")

        self.assertNotEqual(response.status_code, 404)

    def test_valid_public_application_creates_candidate_and_application(self):
        response = self.client.post(
            "/jobs/desenvolvedor-python/applications",
            json={
                "full_name": "Ana Silva",
                "email": "ANA@EXAMPLE.COM ",
                "phone": "(11) 99999-1111",
                "city": "Sao Paulo",
                "neighborhood": "Pinheiros",
                "privacy_accepted": True,
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["status"], "pending_screening")
        self.assertNotIn("candidate_id", response.json())
        self.assertNotIn("application_id", response.json())
        self.assertNotIn("job_id", response.json())
        self.assertIn("public_screening_token", response.json())
        self.assertIn("application_reference", response.json())
        self.assertGreaterEqual(len(response.json()["application_reference"]), 32)

        with self.SessionLocal() as db:
            candidate = db.query(Candidate).filter(Candidate.email == "ana@example.com").one()
            application = db.query(Application).filter(Application.candidate_id == candidate.id).one()
            users = db.query(User).filter(User.email == "ana@example.com").count()

        self.assertIsNone(candidate.user_id)
        self.assertEqual(candidate.phone, "11999991111")
        self.assertEqual(users, 0)
        self.assertEqual(application.status, "pending_screening")
        self.assertIsNotNone(application.privacy_accepted_at)
        self.assertEqual(response.json()["application_reference"], application.appintelli_reference)

    def test_public_application_reference_is_opaque_unique_and_does_not_leak_secrets(self):
        first_response = self.client.post(
            "/jobs/desenvolvedor-python/applications",
            json={
                "full_name": "Referencia Um",
                "email": "referencia1@example.com",
                "phone": "11999991234",
                "city": "Sao Paulo",
                "neighborhood": "Pinheiros",
                "privacy_accepted": True,
            },
        )
        second_response = self.client.post(
            "/jobs/produto-pleno/applications",
            json={
                "full_name": "Referencia Dois",
                "email": "referencia2@example.com",
                "phone": "11999995678",
                "city": "Sao Paulo",
                "neighborhood": "Moema",
                "privacy_accepted": True,
            },
        )

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(second_response.status_code, 201)
        first_payload = first_response.json()
        second_payload = second_response.json()
        self.assertNotEqual(first_payload["application_reference"], second_payload["application_reference"])
        self.assertNotEqual(first_payload["application_reference"], "1")
        self.assertFalse(first_payload["application_reference"].startswith("1-"))
        self.assertNotIn("APPINTELLI_INTEGRATION_SECRET", str(first_payload))
        self.assertNotIn(settings.APPINTELLI_INTEGRATION_SECRET, str(first_payload))
        self.assertNotIn("public_screening_token_hash", str(first_payload))
        self.assertNotIn("candidate_id", str(first_payload))
        self.assertNotIn("application_id", str(first_payload))
        self.assertNotIn("job_id", str(first_payload))

    def test_same_person_in_another_job_reuses_candidate(self):
        first_response = self.client.post(
            "/jobs/desenvolvedor-python/applications",
            json={
                "full_name": "Carla Lima",
                "email": "carla@example.com",
                "phone": "11999993333",
                "city": "Sao Paulo",
                "neighborhood": "Moema",
                "privacy_accepted": True,
            },
        )
        second_response = self.client.post(
            "/jobs/produto-pleno/applications",
            json={
                "full_name": "Carla Lima",
                "email": "CARLA@example.com",
                "phone": "(11) 99999-3333",
                "city": "Sao Paulo",
                "neighborhood": "Moema",
                "privacy_accepted": True,
            },
        )

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(second_response.status_code, 201)
        with self.SessionLocal() as db:
            self.assertEqual(db.query(Candidate).filter(Candidate.email == "carla@example.com").count(), 1)

    def test_duplicate_public_application_is_blocked(self):
        payload = {
            "full_name": "Diego Rocha",
            "email": "diego@example.com",
            "phone": "11999994444",
            "city": "Sao Paulo",
            "neighborhood": "Lapa",
            "privacy_accepted": True,
        }

        self.assertEqual(self.client.post("/jobs/desenvolvedor-python/applications", json=payload).status_code, 201)
        self.assertEqual(self.client.post("/jobs/desenvolvedor-python/applications", json=payload).status_code, 409)

    def test_inactive_or_unapproved_job_blocks_public_application(self):
        payload = {
            "full_name": "Eva Moura",
            "email": "eva@example.com",
            "phone": "11999995555",
            "city": "Sao Paulo",
            "neighborhood": "Vila Mariana",
            "privacy_accepted": True,
        }

        self.assertEqual(self.client.post("/jobs/vaga-oculta/applications", json=payload).status_code, 404)
        self.assertEqual(self.client.post("/jobs/vaga-pendente/applications", json=payload).status_code, 404)

    def test_unknown_slug_blocks_public_application(self):
        response = self.client.post(
            "/jobs/nao-existe/applications",
            json={
                "full_name": "Fabio Nunes",
                "email": "fabio@example.com",
                "phone": "11999996666",
                "city": "Sao Paulo",
                "neighborhood": "Santana",
                "privacy_accepted": True,
            },
        )

        self.assertEqual(response.status_code, 404)

    def test_identity_conflict_does_not_overwrite_existing_candidate(self):
        with self.SessionLocal() as db:
            candidate = Candidate(
                full_name="Gabi Original",
                email="gabi@example.com",
                phone="11999997777",
                city="Sao Paulo",
                neighborhood="Perdizes",
            )
            db.add(candidate)
            db.commit()
            candidate_id = candidate.id

        response = self.client.post(
            "/jobs/desenvolvedor-python/applications",
            json={
                "full_name": "Gabi Diferente",
                "email": "gabi@example.com",
                "phone": "11888887777",
                "city": "Campinas",
                "neighborhood": "Centro",
                "privacy_accepted": True,
            },
        )

        self.assertEqual(response.status_code, 409)
        with self.SessionLocal() as db:
            candidate = db.get(Candidate, candidate_id)

        self.assertEqual(candidate.full_name, "Gabi Original")
        self.assertEqual(candidate.phone, "11999997777")

    def test_privacy_acceptance_is_required(self):
        response = self.client.post(
            "/jobs/desenvolvedor-python/applications",
            json={
                "full_name": "Helena Costa",
                "email": "helena@example.com",
                "phone": "11999998888",
                "city": "Sao Paulo",
                "neighborhood": "Itaim",
                "privacy_accepted": False,
            },
        )

        self.assertEqual(response.status_code, 422)

    def test_user_linked_candidate_is_not_overwritten_by_public_application(self):
        with self.SessionLocal() as db:
            user = User(
                name="Igor Usuario",
                email="igor@example.com",
                hashed_password="hash",
                role="candidate",
            )
            db.add(user)
            db.flush()
            candidate = Candidate(
                user_id=user.id,
                full_name="Igor Usuario",
                email="igor@example.com",
                phone="11999990000",
                city="Sao Paulo",
                neighborhood="Centro",
            )
            db.add(candidate)
            db.commit()
            candidate_id = candidate.id

        response = self.client.post(
            "/jobs/desenvolvedor-python/applications",
            json={
                "full_name": "Nome Novo",
                "email": "igor@example.com",
                "phone": "11999990000",
                "city": "Campinas",
                "neighborhood": "Outro Bairro",
                "privacy_accepted": True,
            },
        )

        self.assertEqual(response.status_code, 201)
        with self.SessionLocal() as db:
            candidate = db.get(Candidate, candidate_id)

        self.assertEqual(candidate.full_name, "Igor Usuario")
        self.assertEqual(candidate.city, "Sao Paulo")

    def test_private_application_endpoint_stays_protected(self):
        self.client.app.dependency_overrides.pop(get_current_user, None)
        response = self.client.get("/applications")

        self.assertEqual(response.status_code, 401)
        self.client.app.dependency_overrides[get_current_user] = lambda: self.admin_user

    def _create_application_for_screening(
        self,
        email: str = "triagem@example.com",
        phone: str = "11911112222",
        slug: str = "desenvolvedor-python",
    ) -> tuple[int, str]:
        response = self.client.post(
            f"/jobs/{slug}/applications",
            json={
                "full_name": "Triagem Candidato",
                "email": email,
                "phone": phone,
                "city": "Sao Paulo",
                "neighborhood": "Centro",
                "privacy_accepted": True,
            },
        )
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("application_id", response.json())
        with self.SessionLocal() as db:
            candidate = db.query(Candidate).filter(Candidate.email == email).one()
            application = db.query(Application).filter(Application.candidate_id == candidate.id).one()
        return application.id, response.json()["public_screening_token"]

    def _application_reference(self, application_id: int) -> str:
        with self.SessionLocal() as db:
            application = db.get(Application, application_id)
            return application.appintelli_reference

    def _configure_screening_questions(self) -> list[ScreeningQuestion]:
        with self.SessionLocal() as db:
            questions = replace_admin_screening_questions(
                db,
                self.admin_user,
                1,
                [
                    ScreeningQuestionCreate(
                        key="availability_6x1",
                        label="Voce tem disponibilidade para escala 6x1?",
                        question_type="YES_NO",
                        required=True,
                        rule={"operator": "EQUALS", "value": True},
                        sort_order=0,
                    ),
                    ScreeningQuestionCreate(
                        key="shift_availability",
                        label="Qual sua disponibilidade?",
                        question_type="SINGLE_SELECT",
                        required=True,
                        options=[
                            {"value": "morning", "label": "Manha"},
                            {"value": "afternoon", "label": "Tarde"},
                            {"value": "night", "label": "Noite"},
                        ],
                        rule={"operator": "IN", "values": ["afternoon", "night"]},
                        sort_order=1,
                    ),
                    ScreeningQuestionCreate(
                        key="start_date",
                        label="Quando pode comecar?",
                        question_type="TEXT",
                        required=False,
                        sort_order=2,
                    ),
                ],
            )
        self.assertEqual(len(questions), 3)
        with self.SessionLocal() as db:
            return db.query(ScreeningQuestion).order_by(ScreeningQuestion.sort_order).all()

    def test_admin_can_configure_generic_screening_questions(self):
        questions = self._configure_screening_questions()

        self.assertEqual(questions[0].question_type, "YES_NO")
        self.assertEqual(questions[1].options[2]["value"], "night")
        self.assertEqual(questions[1].options[2]["label"], "Noite")
        self.assertEqual(questions[1].rule, {"operator": "IN", "values": ["afternoon", "night"]})

    def test_public_job_exposes_questions_without_rules(self):
        self._configure_screening_questions()
        response = self.client.get("/jobs/desenvolvedor-python")

        self.assertEqual(response.status_code, 200)
        question = response.json()["screening_questions"][1]
        self.assertEqual(question["options"][2], {"value": "night", "label": "Noite"})
        self.assertNotIn("rule", question)

    def test_screening_qualified_is_deterministic(self):
        questions = self._configure_screening_questions()
        application_id, token = self._create_application_for_screening()

        response = self.client.post(
            f"/public/applications/{token}/screening",
            json={
                "answers": [
                    {"question_id": questions[0].id, "value": True},
                    {"question_id": questions[1].id, "value": "night"},
                    {"question_id": questions[2].id, "value": "amanha"},
                ]
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["screening_status"], "QUALIFIED")
        self.assertEqual(response.json()["screening_score"], 100)
        with self.SessionLocal() as db:
            application = db.get(Application, application_id)
        self.assertIsNotNone(application.screening_completed_at)

    def test_screening_not_matched_is_deterministic(self):
        questions = self._configure_screening_questions()
        application_id, token = self._create_application_for_screening()

        response = self.client.post(
            f"/public/applications/{token}/screening",
            json={
                "answers": [
                    {"question_id": questions[0].id, "value": True},
                    {"question_id": questions[1].id, "value": "morning"},
                ]
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["screening_status"], "NOT_MATCHED")
        with self.SessionLocal() as db:
            application = db.get(Application, application_id)
        self.assertIsNotNone(application.screening_completed_at)

    def test_missing_required_answer_is_pending_without_completed_at(self):
        questions = self._configure_screening_questions()
        application_id, token = self._create_application_for_screening()

        response = self.client.post(
            f"/public/applications/{token}/screening",
            json={"answers": [{"question_id": questions[1].id, "value": "night"}]},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["screening_status"], "PENDING")
        with self.SessionLocal() as db:
            application = db.get(Application, application_id)
        self.assertIsNone(application.screening_completed_at)

    def test_screening_review_when_no_rules_exist(self):
        with self.SessionLocal() as db:
            replace_admin_screening_questions(
                db,
                self.admin_user,
                1,
                [
                    ScreeningQuestionCreate(
                        key="start_date",
                        label="Quando pode comecar?",
                        question_type="TEXT",
                        required=False,
                    )
                ],
            )
            question = db.query(ScreeningQuestion).one()
        application_id, token = self._create_application_for_screening()

        response = self.client.post(
            f"/public/applications/{token}/screening",
            json={"answers": [{"question_id": question.id, "value": "semana que vem"}]},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["screening_status"], "REVIEW")
        with self.SessionLocal() as db:
            application = db.get(Application, application_id)
        self.assertIsNotNone(application.screening_completed_at)

    def test_public_screening_token_is_opaque_and_hashed(self):
        application_id, token = self._create_application_for_screening()

        self.assertGreaterEqual(len(token), 32)
        self.assertNotEqual(token, str(application_id))
        self.assertFalse(token.startswith(f"{application_id}-"))
        with self.SessionLocal() as db:
            application = db.get(Application, application_id)
        self.assertNotEqual(application.public_screening_token_hash, token)
        self.assertEqual(len(application.public_screening_token_hash), 64)

    def test_invalid_public_screening_token_returns_neutral_404(self):
        response = self.client.get("/public/applications/not-a-real-token/screening")

        self.assertEqual(response.status_code, 404)

    def test_token_for_application_a_does_not_access_b(self):
        first_application_id, first_token = self._create_application_for_screening()
        second_application_id, _second_token = self._create_application_for_screening(
            email="outro@example.com",
            phone="11911113333",
            slug="produto-pleno",
        )

        response = self.client.get(f"/public/applications/{first_token}/screening")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["job"]["slug"], "desenvolvedor-python")
        self.assertNotEqual(first_application_id, second_application_id)

    def test_public_screening_endpoint_does_not_expose_rules_or_candidate_pii(self):
        self._configure_screening_questions()
        _application_id, token = self._create_application_for_screening()

        response = self.client.get(f"/public/applications/{token}/screening")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertNotIn("candidate_id", payload)
        self.assertNotIn("email", str(payload).lower())
        self.assertNotIn("phone", str(payload).lower())
        self.assertNotIn("rule", str(payload).lower())
        self.assertNotIn("values", str(payload).lower())

    def test_raw_application_id_is_not_public_screening_authorization(self):
        application_id, _token = self._create_application_for_screening()

        response = self.client.post(f"/applications/{application_id}/screening", json={"answers": []})

        self.assertEqual(response.status_code, 404)

    def test_appintelli_context_requires_authorization(self):
        application_id, _token = self._create_application_for_screening()
        reference = self._application_reference(application_id)

        missing_response = self.client.get(f"/integrations/appintelli/applications/{reference}/screening")
        invalid_response = self.client.get(
            f"/integrations/appintelli/applications/{reference}/screening",
            headers=self._integration_headers("wrong-secret"),
        )

        self.assertEqual(missing_response.status_code, 401)
        self.assertEqual(invalid_response.status_code, 401)

    def test_appintelli_screening_uses_reference_without_public_application_id(self):
        self._configure_screening_questions()
        response = self.client.post(
            "/jobs/desenvolvedor-python/applications",
            json={
                "full_name": "Sem Id Publico",
                "email": "semid@example.com",
                "phone": "11911119999",
                "city": "Sao Paulo",
                "neighborhood": "Centro",
                "privacy_accepted": True,
            },
        )
        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertNotIn("application_id", payload)
        self.assertNotIn("job_id", payload)

        reference = payload["application_reference"]
        context_response = self.client.get(
            f"/integrations/appintelli/applications/{reference}/screening",
            headers=self._integration_headers(),
        )

        self.assertEqual(context_response.status_code, 200)
        self.assertEqual(context_response.json()["application_reference"], reference)

    def test_appintelli_context_returns_questions_without_sensitive_data(self):
        self._configure_screening_questions()
        application_id, _token = self._create_application_for_screening()
        reference = self._application_reference(application_id)

        response = self.client.get(
            f"/integrations/appintelli/applications/{reference}/screening",
            headers=self._integration_headers(),
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["application_reference"], reference)
        self.assertEqual(payload["job"], {"title": "Desenvolvedor Python"})
        self.assertEqual(payload["questions"][0]["key"], "availability_6x1")
        self.assertEqual(payload["questions"][0]["type"], "YES_NO")
        self.assertNotIn("application_id", str(payload))
        self.assertNotIn("candidate_id", str(payload))
        self.assertNotIn("job_id", str(payload))
        self.assertNotIn("email", str(payload).lower())
        self.assertNotIn("phone", str(payload).lower())
        self.assertNotIn("public_screening_token", str(payload))
        self.assertNotIn("rule", str(payload).lower())
        self.assertNotIn("values", str(payload).lower())

    def test_appintelli_unknown_reference_returns_neutral_404(self):
        response = self.client.get(
            "/integrations/appintelli/applications/not-a-reference/screening",
            headers=self._integration_headers(),
        )

        self.assertEqual(response.status_code, 404)

    def test_appintelli_post_accepts_valid_answer_types_and_reports_missing_required(self):
        self._configure_screening_questions()
        application_id, _token = self._create_application_for_screening()
        reference = self._application_reference(application_id)

        response = self.client.post(
            f"/integrations/appintelli/applications/{reference}/screening/answers",
            headers=self._integration_headers(),
            json={
                "answers": [
                    {"question_key": "availability_6x1", "value": True},
                    {"question_key": "start_date", "value": "amanha"},
                ]
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["screening_status"], "PENDING")
        self.assertEqual(response.json()["missing_required_questions"][0]["key"], "shift_availability")
        with self.SessionLocal() as db:
            application = db.get(Application, application_id)
            answers_count = db.query(application.screening_answers[0].__class__).filter_by(application_id=application_id).count()
        self.assertEqual(answers_count, 2)
        self.assertIsNone(application.screening_completed_at)

    def test_appintelli_post_single_select_valid_can_qualify_application(self):
        self._configure_screening_questions()
        application_id, _token = self._create_application_for_screening()
        reference = self._application_reference(application_id)

        response = self.client.post(
            f"/integrations/appintelli/applications/{reference}/screening/answers",
            headers=self._integration_headers(),
            json={
                "answers": [
                    {"question_key": "availability_6x1", "value": True},
                    {"question_key": "shift_availability", "value": "night"},
                    {"question_key": "start_date", "value": "semana que vem"},
                ]
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["screening_status"], "QUALIFIED")
        self.assertEqual(response.json()["missing_required_questions"], [])
        with self.SessionLocal() as db:
            application = db.get(Application, application_id)
        self.assertEqual(application.screening_status, "QUALIFIED")
        self.assertEqual(application.screening_score, 100)
        self.assertIsNotNone(application.screening_completed_at)

    def test_appintelli_post_rejects_unknown_question_and_invalid_option(self):
        self._configure_screening_questions()
        application_id, _token = self._create_application_for_screening()
        reference = self._application_reference(application_id)

        unknown_response = self.client.post(
            f"/integrations/appintelli/applications/{reference}/screening/answers",
            headers=self._integration_headers(),
            json={"answers": [{"question_key": "unknown", "value": True}]},
        )
        invalid_option_response = self.client.post(
            f"/integrations/appintelli/applications/{reference}/screening/answers",
            headers=self._integration_headers(),
            json={"answers": [{"question_key": "shift_availability", "value": "dawn"}]},
        )

        self.assertEqual(unknown_response.status_code, 422)
        self.assertEqual(invalid_option_response.status_code, 422)

    def test_appintelli_post_rejects_question_from_another_job(self):
        self._configure_screening_questions()
        with self.SessionLocal() as db:
            replace_admin_screening_questions(
                db,
                self.admin_user,
                3,
                [
                    ScreeningQuestionCreate(
                        key="other_job_question",
                        label="Pergunta de outra vaga?",
                        question_type="YES_NO",
                        required=True,
                    )
                ],
            )
        application_id, _token = self._create_application_for_screening()
        reference = self._application_reference(application_id)

        response = self.client.post(
            f"/integrations/appintelli/applications/{reference}/screening/answers",
            headers=self._integration_headers(),
            json={"answers": [{"question_key": "other_job_question", "value": True}]},
        )

        self.assertEqual(response.status_code, 422)

    def test_appintelli_post_invalid_batch_does_not_persist_partial_answers(self):
        self._configure_screening_questions()
        application_id, _token = self._create_application_for_screening()
        reference = self._application_reference(application_id)

        response = self.client.post(
            f"/integrations/appintelli/applications/{reference}/screening/answers",
            headers=self._integration_headers(),
            json={
                "answers": [
                    {"question_key": "availability_6x1", "value": True},
                    {"question_key": "shift_availability", "value": "invalid"},
                ]
            },
        )

        self.assertEqual(response.status_code, 422)
        with self.SessionLocal() as db:
            application = db.get(Application, application_id)
            self.assertEqual(len(application.screening_answers), 0)

    def test_appintelli_post_retry_does_not_duplicate_and_change_recalculates(self):
        self._configure_screening_questions()
        application_id, _token = self._create_application_for_screening()
        reference = self._application_reference(application_id)
        payload = {
            "answers": [
                {"question_key": "availability_6x1", "value": True},
                {"question_key": "shift_availability", "value": "night"},
            ]
        }

        first_response = self.client.post(
            f"/integrations/appintelli/applications/{reference}/screening/answers",
            headers=self._integration_headers(),
            json=payload,
        )
        retry_response = self.client.post(
            f"/integrations/appintelli/applications/{reference}/screening/answers",
            headers=self._integration_headers(),
            json=payload,
        )
        changed_response = self.client.post(
            f"/integrations/appintelli/applications/{reference}/screening/answers",
            headers=self._integration_headers(),
            json={"answers": [{"question_key": "shift_availability", "value": "morning"}]},
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(retry_response.status_code, 200)
        self.assertEqual(changed_response.status_code, 200)
        self.assertEqual(changed_response.json()["screening_status"], "NOT_MATCHED")
        with self.SessionLocal() as db:
            application = db.get(Application, application_id)
            self.assertEqual(len(application.screening_answers), 2)
            self.assertEqual(application.screening_status, "NOT_MATCHED")

    def test_appintelli_request_cannot_set_screening_or_application_status(self):
        self._configure_screening_questions()
        application_id, _token = self._create_application_for_screening()
        reference = self._application_reference(application_id)

        response = self.client.post(
            f"/integrations/appintelli/applications/{reference}/screening/answers",
            headers=self._integration_headers(),
            json={
                "answers": [{"question_key": "availability_6x1", "value": True}],
                "screening_status": "QUALIFIED",
                "status": "hired",
            },
        )

        self.assertEqual(response.status_code, 422)
        with self.SessionLocal() as db:
            application = db.get(Application, application_id)
        self.assertEqual(application.status, "pending_screening")
        self.assertEqual(application.screening_status, "pending_screening")


if __name__ == "__main__":
    unittest.main()
