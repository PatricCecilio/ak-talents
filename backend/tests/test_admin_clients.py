import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import admin, jobs, recruiter
from app.core import messages
from app.core.errors import install_error_handlers
from app.core.security import create_access_token
from app.database.base import Base
from app.database.session import get_db
from app.models.company import Company
from app.models.user import User

COMPANY = {
    "company_name": "Padaria Boa Massa",
    "cnpj": "12.345.678/0001-90",
    "responsible_name": "Marta Souza",
    "whatsapp": "(41) 99999-0000",
    "contact_email": "Marta@BoaMassa.com.br",
    "city": "Curitiba",
    "state": "pr",
    "notes": "Prefere receber os relatórios à tarde.",
}


class AdminClientsTestCase(unittest.TestCase):
    """The AK admin registers client companies (no login) and opens their jobs, without the approval step."""

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
            db.commit()

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        install_error_handlers(app)
        for module, prefix in ((admin, "/admin"), (jobs, "/jobs"), (recruiter, "/recruiter")):
            app.include_router(module.router, prefix=prefix)
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def call(self, method: str, path: str, role: str = "admin", **kwargs):
        headers = {"Authorization": f"Bearer {create_access_token(self.users[role].id)}"}
        return self.client.request(method, path, headers=headers, **kwargs)

    def create_company(self, **overrides) -> dict:
        response = self.call("POST", "/admin/companies", json={**COMPANY, **overrides})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def job_payload(self, company_id: int, **overrides) -> dict:
        return {
            "company_id": company_id,
            "title": "Auxiliar de padeiro",
            "description": "Ajudar na produção de pães e doces.",
            "requirements": "Experiência de 6 meses.",
            "salary_min": 1800,
            "salary_max": 2200,
            "location": "Curitiba - PR",
            "work_mode": "Presencial",
            "schedule": "Segunda a sábado, 5h às 13h",
            "benefits": "Vale-transporte e refeição no local",
            "contract_type": "clt",
            "openings": 2,
            "recruiter_id": self.users["recruiter"].id,
            "status": "approved",
            **overrides,
        }

    # --- companies -----------------------------------------------------------------------------------

    def test_admin_creates_a_company_without_login_with_normalized_fields(self) -> None:
        body = self.create_company()
        self.assertIsNone(body["user_id"])
        self.assertFalse(body["has_account"])
        self.assertIsNone(body["email"])
        self.assertEqual(body["cnpj"], "12345678000190")
        self.assertEqual(body["whatsapp"], "41999990000")
        self.assertEqual(body["contact_email"], "marta@boamassa.com.br")
        self.assertEqual(body["state"], "PR")
        self.assertEqual(body["status"], "approved")
        self.assertTrue(body["is_active"])
        self.assertEqual(body["jobs_count"], 0)
        listed = self.call("GET", "/admin/companies").json()
        self.assertEqual([company["company_name"] for company in listed], ["Padaria Boa Massa"])

    def test_only_name_and_whatsapp_are_required(self) -> None:
        body = self.create_company(cnpj="", responsible_name="", contact_email="", city="", state="", notes="")
        self.assertIsNone(body["cnpj"])
        self.assertIsNone(body["contact_email"])
        missing = self.call("POST", "/admin/companies", json={"company_name": "Sem WhatsApp"})
        self.assertEqual(missing.status_code, 422)

    def test_invalid_cnpj_and_whatsapp_get_portuguese_messages(self) -> None:
        cnpj = self.call("POST", "/admin/companies", json={**COMPANY, "cnpj": "123"})
        self.assertEqual(cnpj.status_code, 422)
        self.assertEqual(cnpj.json()["detail"], messages.INVALID_CNPJ)
        whatsapp = self.call("POST", "/admin/companies", json={**COMPANY, "whatsapp": "9999-0000"})
        self.assertEqual(whatsapp.status_code, 422)
        self.assertEqual(whatsapp.json()["detail"], messages.INVALID_WHATSAPP)

    def test_admin_edits_and_deactivates_without_deleting(self) -> None:
        company = self.create_company()
        edited = self.call("PUT", f"/admin/companies/{company['id']}", json={**COMPANY, "company_name": "Padaria Nova", "notes": None})
        self.assertEqual(edited.status_code, 200, edited.text)
        self.assertEqual(edited.json()["company_name"], "Padaria Nova")
        self.assertIsNone(edited.json()["notes"])

        self.call("POST", "/admin/jobs", json=self.job_payload(company["id"]))
        self.assertEqual(len(self.client.get("/jobs").json()), 1)

        off = self.call("PUT", f"/admin/companies/{company['id']}/active", json={"is_active": False})
        self.assertFalse(off.json()["is_active"])
        self.assertEqual(self.client.get("/jobs").json(), [])
        self.assertEqual(self.call("GET", "/recruiter/jobs", role="recruiter").json()["jobs"], [])
        # No new jobs for a deactivated company.
        refused = self.call("POST", "/admin/jobs", json=self.job_payload(company["id"]))
        self.assertEqual(refused.status_code, 422)
        self.assertEqual(refused.json()["detail"], messages.INACTIVE_COMPANY)

        self.call("PUT", f"/admin/companies/{company['id']}/active", json={"is_active": True})
        self.assertEqual(len(self.client.get("/jobs").json()), 1)
        with self.SessionLocal() as db:
            self.assertEqual(db.query(Company).count(), 1)

    # --- jobs ----------------------------------------------------------------------------------------

    def test_published_job_goes_straight_to_the_site_with_every_field(self) -> None:
        company = self.create_company()
        response = self.call("POST", "/admin/jobs", json=self.job_payload(company["id"]))
        self.assertEqual(response.status_code, 201, response.text)
        job = response.json()
        self.assertEqual(job["status"], "approved")
        self.assertEqual(job["recruiter_name"], "Pessoa recruiter")
        self.assertEqual(job["company_name"], "Padaria Boa Massa")

        public = self.client.get("/jobs").json()
        self.assertEqual(len(public), 1)
        self.assertEqual(public[0]["schedule"], "Segunda a sábado, 5h às 13h")
        self.assertEqual(public[0]["openings"], 2)
        self.assertEqual(public[0]["contract_type"], "clt")
        detail = self.call("GET", f"/admin/jobs/{job['id']}").json()
        self.assertEqual(detail["salary_min"], 1800)
        self.assertEqual(detail["benefits"], "Vale-transporte e refeição no local")
        self.assertEqual(detail["recruiter_id"], self.users["recruiter"].id)

    def test_draft_and_closed_jobs_stay_off_the_site_and_the_link_never_changes(self) -> None:
        company = self.create_company()
        job = self.call("POST", "/admin/jobs", json=self.job_payload(company["id"], status="draft")).json()
        self.assertEqual(self.client.get("/jobs").json(), [])

        published = self.call("PUT", f"/admin/jobs/{job['id']}", json=self.job_payload(company["id"], title="Padeiro", status="approved"))
        self.assertEqual(published.status_code, 200, published.text)
        public = self.client.get("/jobs").json()
        self.assertEqual([item["title"] for item in public], ["Padeiro"])
        slug = public[0]["slug"]
        self.assertTrue(slug.startswith("auxiliar-de-padeiro"))

        closed = self.call("PUT", f"/admin/jobs/{job['id']}", json=self.job_payload(company["id"], title="Padeiro", status="closed"))
        self.assertEqual(closed.json()["status"], "closed")
        self.assertFalse(closed.json()["is_active"])
        self.assertEqual(self.client.get(f"/jobs/{slug}").status_code, 404)

    def test_job_validation(self) -> None:
        company = self.create_company()
        salary = self.call("POST", "/admin/jobs", json=self.job_payload(company["id"], salary_min=3000, salary_max=2000))
        self.assertEqual(salary.status_code, 422)
        status = self.call("POST", "/admin/jobs", json=self.job_payload(company["id"], status="pending"))
        self.assertEqual(status.status_code, 422)
        unknown_company = self.call("POST", "/admin/jobs", json=self.job_payload(9999))
        self.assertEqual(unknown_company.status_code, 404)
        candidate_as_recruiter = self.call("POST", "/admin/jobs", json=self.job_payload(company["id"], recruiter_id=self.users["candidate"].id))
        self.assertEqual(candidate_as_recruiter.status_code, 422)

    def test_recruiters_cannot_manage_companies_or_jobs(self) -> None:
        company = self.create_company()
        for method, path, payload in (
            ("GET", "/admin/companies", None),
            ("POST", "/admin/companies", COMPANY),
            ("PUT", f"/admin/companies/{company['id']}", COMPANY),
            ("PUT", f"/admin/companies/{company['id']}/active", {"is_active": False}),
            ("POST", "/admin/jobs", self.job_payload(company["id"])),
            ("GET", "/admin/recruiters", None),
            ("GET", "/admin/users", None),
        ):
            with self.subTest(path=path, method=method):
                self.assertEqual(self.call(method, path, role="recruiter", json=payload).status_code, 403)
        for method, path in (("GET", "/admin/companies"), ("POST", "/admin/companies")):
            self.assertEqual(self.call(method, path, role="candidate", json=COMPANY).status_code, 403)


if __name__ == "__main__":
    unittest.main()
