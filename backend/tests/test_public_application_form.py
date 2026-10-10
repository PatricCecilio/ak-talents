import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import jobs
from app.core.errors import install_error_handlers
from app.core.rate_limit import limiter
from app.database.base import Base
from app.database.session import get_db
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.user import User

APPLICANT = {
    "full_name": "Júlia Souza",
    "email": "julia@example.com",
    "phone": "41988887777",
    "city": "Curitiba",
    "privacy_accepted": True,
}


class PublicApplicationFormTestCase(unittest.TestCase):
    def setUp(self) -> None:
        limiter.reset()
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
        with self.SessionLocal() as db:
            owner = User(name="Empresa", email="empresa@example.com", hashed_password="x", role="company", is_active=True)
            db.add(owner)
            db.flush()
            company = Company(user_id=owner.id, company_name="Empresa", status="approved")
            db.add(company)
            db.flush()
            db.add(Job(company_id=company.id, title="Atendente", slug="atendente", description="Atendimento ao público.", status="approved", is_active=True))
            db.commit()

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        install_error_handlers(app)
        app.include_router(jobs.router, prefix="/jobs")
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def apply(self, **changes) -> dict:
        payload = {**APPLICANT, **changes}
        response = self.client.post("/jobs/atendente/applications", json=payload)
        self.assertEqual(response.status_code, 201, response.text)
        with self.SessionLocal() as db:
            application = db.query(Application).order_by(Application.id.desc()).first()
            candidate = db.get(Candidate, application.candidate_id)
            return {"full_name": candidate.full_name, "neighborhood": candidate.neighborhood}

    def test_neighborhood_is_optional(self) -> None:
        self.assertIsNone(self.apply()["neighborhood"])

    def test_blank_neighborhood_is_stored_as_empty(self) -> None:
        self.assertIsNone(self.apply(neighborhood="   ")["neighborhood"])

    def test_neighborhood_is_kept_when_given(self) -> None:
        self.assertEqual(self.apply(neighborhood="  Centro ")["neighborhood"], "Centro")


if __name__ == "__main__":
    unittest.main()
