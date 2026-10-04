"""Create an AK Talent admin account interactively. Safe for production: nothing is hard-coded.

Usage, from backend/ (with DATABASE_URL pointing to the target database):
    python -m app.scripts.create_admin

Asks for name and e-mail, reads the password twice without echoing it, shows which database will be
changed and asks for confirmation before writing.
"""

from getpass import getpass

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core import config as app_config
from app.core.security import get_password_hash
from app.models.user import User, UserRole

MIN_ADMIN_PASSWORD_LENGTH = 12
_email_adapter = TypeAdapter(EmailStr)


class AdminCreationError(ValueError):
    pass


def create_admin_user(db: Session, name: str, email: str, password: str) -> User:
    name = name.strip()
    if len(name) < 2:
        raise AdminCreationError("Informe um nome com pelo menos 2 caracteres.")

    try:
        email = str(_email_adapter.validate_python(email.strip())).lower()
    except ValidationError as exc:
        raise AdminCreationError("E-mail inválido.") from exc

    if len(password) < MIN_ADMIN_PASSWORD_LENGTH:
        raise AdminCreationError(f"A senha precisa ter pelo menos {MIN_ADMIN_PASSWORD_LENGTH} caracteres.")

    if db.query(User).filter(User.email == email).first():
        raise AdminCreationError("Já existe um usuário com este e-mail.")

    user = User(
        name=name,
        email=email,
        hashed_password=get_password_hash(password),
        role=UserRole.admin.value,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _database_label() -> str:
    url = make_url(app_config.settings.DATABASE_URL)
    return f"{url.get_backend_name()}://{url.host or ''}/{url.database or ''}"  # never prints the password


def main() -> int:
    from app.database.session import SessionLocal

    print("Criar usuário administrador da AK Talent")
    print(f"Banco de dados: {_database_label()} (ENVIRONMENT={app_config.settings.ENVIRONMENT})")
    name = input("Nome: ")
    email = input("E-mail: ")
    password = getpass(f"Senha (mínimo {MIN_ADMIN_PASSWORD_LENGTH} caracteres): ")
    if password != getpass("Repita a senha: "):
        print("As senhas não conferem. Nada foi criado.")
        return 1

    if input(f"Criar o admin {email.strip()} neste banco? (s/N): ").strip().lower() != "s":
        print("Cancelado. Nada foi criado.")
        return 1

    with SessionLocal() as db:
        try:
            user = create_admin_user(db, name, email, password)
        except AdminCreationError as exc:
            print(f"Erro: {exc} Nada foi criado.")
            return 1

    print(f"Admin criado: {user.email} (id {user.id}). Entre em /login com este e-mail e senha.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
