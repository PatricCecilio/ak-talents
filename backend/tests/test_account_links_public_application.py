import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import auth, candidates, jobs
from app.core.rate_limit import limiter
from app.database.base import Base
from app.database.session import get_db
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.user import User


class AccountLinksPublicApplicationTestCase(unittest.TestCase):
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
            db.add(Job(company_id=company.id, title="Atendente", slug="atendente", description="Atendimento.", status="approved", is_active=True))
            db.commit()

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        for module, prefix in ((auth, "/auth"), (candidates, "/candidates"), (jobs, "/jobs")):
            app.include_router(module.router, prefix=prefix)
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self) -> None:
        limiter.reset()

    def test_public_application_with_account_email_shows_in_my_applications(self) -> None:
        register = self.client.post(
            "/auth/register",
            json={"name": "Júlia Lima", "email": "Julia@Example.com", "password": "senha-forte-1", "role": "candidate", "privacy_accepted": True},
        )
        self.assertEqual(register.status_code, 201, register.text)
        token = register.json()["access_token"]

        applied = self.client.post(
            "/jobs/atendente/applications",
            json={"full_name": "Júlia Lima", "email": "julia@example.com", "phone": "41988887777", "city": "Curitiba", "neighborhood": "Centro", "privacy_accepted": True},
        )
        self.assertEqual(applied.status_code, 201, applied.text)

        with self.SessionLocal() as db:
            self.assertEqual(db.query(Candidate).count(), 1)  # linked, not duplicated
        mine = self.client.get("/candidates/me/applications", headers={"Authorization": f"Bearer {token}"}).json()
        self.assertEqual([(item["job_title"], item["status_label"]) for item in mine["applications"]], [("Atendente", "Recebida")])


if __name__ == "__main__":
    unittest.main()
