import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.api.routes import jobs
from app.core.errors import install_error_handlers
from app.database.base import Base
from app.database.session import get_db
from app.models.company import Company
from app.models.job import Job
from app.models.user import User

BASIC_JOB = {
    "title": "Atendente de loja",
    "description": "Atender clientes no balcão e operar o caixa.",
    "salary_min": 1800,
    "salary_max": 2200,
    "location": "Curitiba, PR",
    "work_mode": "onsite",
}
DETAILS = {
    "schedule": "Seg a sáb, 6x1, 8h às 16h20",
    "benefits": "Vale-transporte, vale-refeição",
    "contract_type": "clt",
    "openings": 2,
}


class JobDetailsTestCase(unittest.TestCase):
    def setUp(self) -> None:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
        with self.SessionLocal() as db:
            self.user = User(name="Ana", email="ana@example.com", hashed_password="x", role="company", is_active=True)
            db.add(self.user)
            db.flush()
            db.add(Company(user_id=self.user.id, company_name="Mercado", status="approved"))
            db.commit()

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        install_error_handlers(app)
        app.include_router(jobs.router, prefix="/jobs")
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: self.user
        self.client = TestClient(app)

    def create(self, **fields):
        return self.client.post("/jobs", json={**BASIC_JOB, **fields})

    def publish(self, slug: str) -> None:
        with self.SessionLocal() as db:
            db.query(Job).filter(Job.slug == slug).update({"status": "approved"})
            db.commit()

    def test_job_with_details_and_the_public_page_shows_them(self) -> None:
        response = self.create(**DETAILS)
        self.assertEqual(response.status_code, 201, response.text)
        slug = response.json()["slug"]
        self.publish(slug)

        public = self.client.get(f"/jobs/{slug}").json()
        for field, value in DETAILS.items():
            self.assertEqual(public[field], value, field)
        listed = self.client.get("/jobs").json()[0]
        self.assertEqual(listed["contract_type"], "clt")
        self.assertEqual(listed["schedule"], DETAILS["schedule"])

    def test_details_are_optional(self) -> None:
        response = self.create(schedule="", benefits="  ", contract_type="")
        self.assertEqual(response.status_code, 201, response.text)
        body = response.json()
        for field in DETAILS:
            self.assertIsNone(body[field], field)

    def test_invalid_details_get_portuguese_messages(self) -> None:
        wrong_contract = self.create(contract_type="freela")
        self.assertEqual(wrong_contract.status_code, 422)
        self.assertEqual(wrong_contract.json()["detail"][0]["msg"], "Tipo de contrato: escolha uma das opções.")

        zero_openings = self.create(openings=0)
        self.assertEqual(zero_openings.status_code, 422)
        self.assertEqual(zero_openings.json()["detail"][0]["msg"], "Quantidade de vagas: o valor não pode ser menor que 1.")


if __name__ == "__main__":
    unittest.main()
