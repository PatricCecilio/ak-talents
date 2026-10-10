import ast
import re
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import auth, jobs
from app.core import messages
from app.core.errors import install_error_handlers
from app.core.rate_limit import limiter
from app.database.base import Base
from app.database.session import get_db
from app.models.company import Company
from app.models.job import Job
from app.models.user import User

APP_DIR = Path(__file__).resolve().parents[1] / "app"
ENGLISH = re.compile(
    r"\b(not|found|only|invalid|required|already|exists|cannot|access|unauthorized|duplicate|requires|supported|"
    r"profile|blocked|answer|question)\b",
    re.IGNORECASE,
)
UNACCENTED = re.compile(r"\b(Nao|nao|possivel|voce|informacoes|usuario|invalido)\b")

APPLICANT = {
    "full_name": "Júlia Souza",
    "email": "julia@example.com",
    "phone": "41988887777",
    "city": "Curitiba",
    "neighborhood": "Centro",
    "privacy_accepted": True,
}


def literal_messages() -> list[tuple[str, int, str]]:
    """Every string literal passed as detail=... or to ValueError(...) in the app."""
    found = []
    for path in APP_DIR.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            values = [kw.value for kw in node.keywords if kw.arg == "detail"]
            if isinstance(node.func, ast.Name) and node.func.id == "ValueError":
                values += node.args[:1]
            for value in values:
                parts = [value] if isinstance(value, ast.Constant) else [v for v in getattr(value, "values", []) if isinstance(v, ast.Constant)]
                for part in parts:
                    if isinstance(part.value, str):
                        found.append((path.name, node.lineno, part.value))
    return found


class MessagesInPortugueseTestCase(unittest.TestCase):
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
        app.include_router(auth.router, prefix="/auth")
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def test_duplicate_application_gets_the_reassuring_message(self) -> None:
        self.assertEqual(self.client.post("/jobs/atendente/applications", json=APPLICANT).status_code, 201)
        again = self.client.post("/jobs/atendente/applications", json=APPLICANT)
        self.assertEqual(again.status_code, 409)
        self.assertEqual(
            again.json()["detail"],
            "Você já se candidatou a esta vaga. Fique tranquilo: a equipe AK Talent vai entrar em contato.",
        )

    def test_validation_errors_are_in_portuguese_and_do_not_echo_the_input(self) -> None:
        response = self.client.post("/auth/register", json={"email": "sem-arroba", "password": "1", "name": "", "role": "candidate"})
        self.assertEqual(response.status_code, 422)
        errors = response.json()["detail"]
        messages_by_field = {error["loc"][-1]: error["msg"] for error in errors}
        self.assertEqual(messages_by_field["email"], "Informe um e-mail válido.")
        self.assertEqual(messages_by_field["password"], "Senha: escreva pelo menos 8 caracteres.")
        self.assertEqual(messages_by_field["name"], "Nome: escreva pelo menos 2 caracteres.")
        for error in errors:
            self.assertNotIn("input", error)

        missing = self.client.post("/jobs/atendente/applications", json={"privacy_accepted": True}).json()["detail"]
        self.assertIn("Preencha o campo Nome completo.", [error["msg"] for error in missing])

    def test_framework_defaults_are_translated(self) -> None:
        self.assertEqual(self.client.get("/nao-existe").json()["detail"], "Página ou recurso não encontrado.")
        self.assertEqual(self.client.get("/jobs/vaga-que-nao-existe").json()["detail"], "Vaga não encontrada.")

    def test_own_validators_keep_their_portuguese_message(self) -> None:
        error = {"type": "value_error", "loc": ("body", "salary_min"), "msg": "Value error, O salário mínimo não pode ser maior que o salário máximo."}
        self.assertEqual(messages.translate_validation_error(error), "O salário mínimo não pode ser maior que o salário máximo.")

    def test_no_english_or_unaccented_message_left_in_the_code(self) -> None:
        offenders = [
            f"{name}:{line}: {text}"
            for name, line, text in literal_messages()
            if ENGLISH.search(text) or UNACCENTED.search(text)
        ]
        self.assertEqual(offenders, [])

    def test_message_constants_are_portuguese(self) -> None:
        constants = {name: value for name, value in vars(messages).items() if name.isupper() and isinstance(value, str)}
        self.assertGreater(len(constants), 20)
        for name, value in constants.items():
            if name == "VALUE_ERROR_PREFIX":
                continue
            self.assertIsNone(ENGLISH.search(value), f"{name}: {value}")


if __name__ == "__main__":
    unittest.main()
