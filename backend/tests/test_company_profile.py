import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.api.routes import companies
from app.core.errors import install_error_handlers
from app.database.base import Base
from app.database.session import get_db
from app.models.company import Company
from app.models.user import User

COMPLETE = {
    "company_name": "Mercado Bom Preço",
    "responsible_name": "Ana Costa",
    "phone": "(41) 99999-9999",
    "city": "Curitiba",
    "state": "PR",
}


class CompanyProfileTestCase(unittest.TestCase):
    def setUp(self) -> None:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
        with self.SessionLocal() as db:
            self.user = User(name="Ana", email="ana@example.com", hashed_password="x", role="company", is_active=True)
            db.add(self.user)
            db.flush()
            # An older profile saved with blanks, as the previous form allowed.
            db.add(Company(user_id=self.user.id, company_name="Mercado", responsible_name="", phone="", city="", state=""))
            db.commit()

        def override_get_db():
            with self.SessionLocal() as db:
                yield db

        app = FastAPI()
        install_error_handlers(app)
        app.include_router(companies.router, prefix="/companies")
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: self.user
        self.client = TestClient(app)

    def test_older_profile_with_blanks_still_opens(self) -> None:
        response = self.client.get("/companies/me")
        self.assertEqual(response.status_code, 200, response.text)

    def test_optional_fields_can_be_left_empty(self) -> None:
        response = self.client.put("/companies/me", json={**COMPLETE, "industry": "", "company_size": "", "description": " ", "website_url": ""})
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["company_name"], "Mercado Bom Preço")
        for field in ("industry", "company_size", "description", "website_url"):
            self.assertIsNone(body[field], field)

    def test_required_fields_cannot_be_blanked(self) -> None:
        for field, label in (("responsible_name", "Responsável"), ("phone", "Telefone"), ("city", "Cidade"), ("state", "Estado"), ("company_name", "Nome da empresa")):
            response = self.client.put("/companies/me", json={**COMPLETE, field: "   "})
            self.assertEqual(response.status_code, 422, field)
            self.assertEqual(response.json()["detail"][0]["msg"], f"Preencha o campo {label}.")

    def test_size_from_the_list_and_clearing_the_website(self) -> None:
        self.client.put("/companies/me", json={**COMPLETE, "company_size": "11 a 50", "website_url": "https://mercado.com.br"})
        self.assertEqual(self.client.get("/companies/me").json()["website_url"], "https://mercado.com.br")
        cleared = self.client.put("/companies/me", json={**COMPLETE, "website_url": ""}).json()
        self.assertIsNone(cleared["website_url"])
        self.assertEqual(cleared["company_size"], "11 a 50")

    def test_partial_update_from_the_assistant_keeps_the_rest(self) -> None:
        self.client.put("/companies/me", json=COMPLETE)
        response = self.client.put("/companies/me", json={"company_name": "Mercado Bom Preço", "city": "Curitiba", "industry": "Varejo"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["phone"], "(41) 99999-9999")
        self.assertEqual(response.json()["industry"], "Varejo")


if __name__ == "__main__":
    unittest.main()
