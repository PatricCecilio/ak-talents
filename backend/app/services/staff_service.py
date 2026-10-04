from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.user import STAFF_ROLES, User, UserRole

MIN_STAFF_PASSWORD_LENGTH = 12
_email_adapter = TypeAdapter(EmailStr)


class StaffCreationError(ValueError):
    """Invalid data for a new staff account; the message is user-facing (Portuguese)."""


class StaffEmailTakenError(StaffCreationError):
    pass


def create_staff_user(db: Session, name: str, email: str, password: str, role: UserRole) -> User:
    """Create an internal AK Talent account (admin or recruiter). Never reachable from public sign-up."""
    if role.value not in STAFF_ROLES:
        raise StaffCreationError("Papel inválido para a equipe interna.")

    name = name.strip()
    if len(name) < 2:
        raise StaffCreationError("Informe um nome com pelo menos 2 caracteres.")

    try:
        email = str(_email_adapter.validate_python(email.strip())).lower()
    except ValidationError as exc:
        raise StaffCreationError("E-mail inválido.") from exc

    if len(password) < MIN_STAFF_PASSWORD_LENGTH:
        raise StaffCreationError(f"A senha precisa ter pelo menos {MIN_STAFF_PASSWORD_LENGTH} caracteres.")

    if db.query(User).filter(User.email == email).first():
        raise StaffEmailTakenError("Já existe um usuário com este e-mail.")

    user = User(name=name, email=email, hashed_password=get_password_hash(password), role=role.value, is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_staff(db: Session, roles: tuple[str, ...] = STAFF_ROLES, only_active: bool = False) -> list[User]:
    query = db.query(User).filter(User.role.in_(roles))
    if only_active:
        query = query.filter(User.is_active.is_(True))
    return query.order_by(User.name).all()
