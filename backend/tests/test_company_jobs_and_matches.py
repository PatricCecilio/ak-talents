import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.api.routes import companies, jobs
from app.database.base import Base
from app.database.session import get_db
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.user import User


class CompanyJobsAndMatchesTestCase(unittest.TestCase):
    def setUp(self) -> None:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

        with self.SessionLocal() as db:
            self.company_user_a, self.company_a = self._company(db, "a")
            self.company_user_b, self.company_b = self._company(db, "b")
            self.job_a_approved = self._job(db, self.company_a, "Atendente", "approved")
            self.job_a_pending = self._job(db, self.company_a, "Caixa", "pending")
            self.job_b = self._job(db, self.company_b, "Estoquista", "approved")

            applicant_user = User(name="Ana Conta", email="ana@example.com", hashed_password="x", role="candidate")
            outsider_user = User(name="Bruno Fora", email="bruno@example.com", hashed_password="x", role="candidate")
            db.add_all([applicant_user, outsider_user])
            db.flush()
            self.applicant = Candidate(user_id=applicant_user.id, skills="atendimento, caixa", city="Curitiba")
            self.outsider = Candidate(user_id=outsider_user.id, skills="atendimento, caixa", city="Curitiba")
            self.public_applicant = Candidate(full_name="Carla Sem Conta", email="carla@example.com", phone="41999990000")
            db.add_all([self.applicant, self.outsider, self.public_applicant])
            db.flush()
            db.add_all(
                [
                    Application(candidate_id=self.applicant.id, job_id=self.job_a_approved.id),
                    Application(candidate_id=self.public_applicant.id, job_id=self.job_a_approved.id),
                    # The outsider applied only to another company's job.
                    Application(candidate_id=self.outsider.id, job_id=self.job_b.id),
                ]
            )
            db.commit()

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        app.include_router(jobs.router, prefix="/jobs")
        app.include_router(companies.router, prefix="/companies")
        app.dependency_overrides[get_db] = override_get_db
        self.app = app
        self.client = TestClient(app)
        self.act_as(self.company_user_a)

    def _company(self, db, suffix: str):
        user = User(name=f"Empresa {suffix}", email=f"empresa-{suffix}@example.com", hashed_password="x", role="company")
        db.add(user)
        db.flush()
        company = Company(user_id=user.id, company_name=f"Empresa {suffix}", status="approved")
        db.add(company)
        db.flush()
        return user, company

    def _job(self, db, company: Company, title: str, status: str) -> Job:
        job = Job(company_id=company.id, title=title, slug=f"{title.lower()}-{company.id}", description="Descrição da vaga.", requirements="atendimento, caixa", location="Curitiba", status=status, is_active=True)
        db.add(job)
        db.flush()
        return job

    def act_as(self, user: User) -> None:
        self.app.dependency_overrides[get_current_user] = lambda: user

    def test_matches_only_include_candidates_who_applied_to_the_job(self) -> None:
        response = self.client.get(f"/jobs/{self.job_a_approved.id}/matches")
        self.assertEqual(response.status_code, 200, response.text)

        names = {match["name"] for match in response.json()}
        self.assertEqual(names, {"Ana Conta", "Carla Sem Conta"})
        self.assertNotIn(self.outsider.id, {match["candidate_id"] for match in response.json()})

    def test_matches_for_job_without_applications_is_empty(self) -> None:
        response = self.client.get(f"/jobs/{self.job_a_pending.id}/matches")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_matches_for_another_company_job_is_not_found(self) -> None:
        self.assertEqual(self.client.get(f"/jobs/{self.job_b.id}/matches").status_code, 404)

    def test_company_lists_only_its_own_jobs_including_pending(self) -> None:
        response = self.client.get("/companies/me/jobs")
        self.assertEqual(response.status_code, 200, response.text)

        jobs_by_id = {job["id"]: job for job in response.json()}
        self.assertEqual(set(jobs_by_id), {self.job_a_approved.id, self.job_a_pending.id})
        self.assertEqual(jobs_by_id[self.job_a_pending.id]["status"], "pending")

        self.act_as(self.company_user_b)
        self.assertEqual({job["id"] for job in self.client.get("/companies/me/jobs").json()}, {self.job_b.id})

    def test_only_companies_can_list_company_jobs(self) -> None:
        candidate_user = User(id=999, name="Pessoa", email="p@example.com", hashed_password="x", role="candidate", is_active=True)
        self.act_as(candidate_user)
        response = self.client.get("/companies/me/jobs")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Você não tem permissão para acessar esta área.")


if __name__ == "__main__":
    unittest.main()
