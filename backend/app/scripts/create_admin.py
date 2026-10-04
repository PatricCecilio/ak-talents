"""Create an AK Talent admin account interactively. Safe for production: nothing is hard-coded.

Usage, from backend/ (with DATABASE_URL pointing to the target database):
    python -m app.scripts.create_admin

Asks for name and e-mail, reads the password twice without echoing it, shows which database will be
changed and asks for confirmation before writing. `create_recruiter` reuses `run_interactive`.
"""

from getpass import getpass

from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core import config as app_config
from app.models.user import User, UserRole
from app.services.staff_service import MIN_STAFF_PASSWORD_LENGTH, StaffCreationError, create_staff_user

# Kept for the existing CLI/tests vocabulary.
MIN_ADMIN_PASSWORD_LENGTH = MIN_STAFF_PASSWORD_LENGTH
AdminCreationError = StaffCreationError

ROLE_LABELS = {UserRole.admin: "administrador", UserRole.recruiter: "recrutador"}


def create_admin_user(db: Session, name: str, email: str, password: str) -> User:
    return create_staff_user(db, name, email, password, UserRole.admin)


def _database_label() -> str:
    url = make_url(app_config.settings.DATABASE_URL)
    return f"{url.get_backend_name()}://{url.host or ''}/{url.database or ''}"  # never prints the password


def run_interactive(role: UserRole) -> int:
    from app.database.session import SessionLocal

    label = ROLE_LABELS[role]
    print(f"Criar usuário {label} da AK Talent")
    print(f"Banco de dados: {_database_label()} (ENVIRONMENT={app_config.settings.ENVIRONMENT})")
    name = input("Nome: ")
    email = input("E-mail: ")
    password = getpass(f"Senha (mínimo {MIN_STAFF_PASSWORD_LENGTH} caracteres): ")
    if password != getpass("Repita a senha: "):
        print("As senhas não conferem. Nada foi criado.")
        return 1

    if input(f"Criar o {label} {email.strip()} neste banco? (s/N): ").strip().lower() != "s":
        print("Cancelado. Nada foi criado.")
        return 1

    with SessionLocal() as db:
        try:
            user = create_staff_user(db, name, email, password, role)
        except StaffCreationError as exc:
            print(f"Erro: {exc} Nada foi criado.")
            return 1

    print(f"Usuário {label} criado: {user.email} (id {user.id}). Entre em /login com este e-mail e senha.")
    return 0


def main() -> int:
    return run_interactive(UserRole.admin)


if __name__ == "__main__":
    raise SystemExit(main())
