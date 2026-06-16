from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.database.base import Base
from app.database.session import SessionLocal, engine
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.user import User, UserRole


ADMIN_EMAIL = "admin@aktalent.com"
COMPANY_EMAIL = "empresa@teste.com"
CANDIDATE_EMAIL = "candidato@teste.com"


def get_or_create_user(
    db: Session,
    *,
    name: str,
    email: str,
    password: str,
    role: UserRole,
) -> User:
    user = db.query(User).filter(User.email == email).first()

    if user:
        user.name = name
        user.role = role.value
        user.is_active = True
        return user

    user = User(
        name=name,
        email=email,
        hashed_password=get_password_hash(password),
        role=role.value,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def seed_admin(db: Session) -> User:
    return get_or_create_user(
        db,
        name="Admin AK Talent",
        email=ADMIN_EMAIL,
        password="admin123",
        role=UserRole.admin,
    )


def seed_company(db: Session) -> Company:
    user = get_or_create_user(
        db,
        name="Empresa Teste",
        email=COMPANY_EMAIL,
        password="empresa123",
        role=UserRole.company,
    )
    company = db.query(Company).filter(Company.user_id == user.id).first()

    if not company:
        company = Company(user_id=user.id, company_name="Empresa Teste")
        db.add(company)

    company.company_name = "Empresa Teste"
    company.responsible_name = "Responsavel Teste"
    company.phone = "(11) 99999-1000"
    company.city = "Sao Paulo"
    company.state = "SP"
    company.industry = "Tecnologia"
    company.company_size = "51-200"
    company.description = "Empresa teste aprovada para validar o fluxo local da AK Talent."
    company.website = "https://empresa-teste.com"
    company.status = "approved"
    db.flush()
    return company


def seed_candidate(db: Session) -> Candidate:
    user = get_or_create_user(
        db,
        name="Candidato Teste",
        email=CANDIDATE_EMAIL,
        password="candidato123",
        role=UserRole.candidate,
    )
    candidate = db.query(Candidate).filter(Candidate.user_id == user.id).first()

    if not candidate:
        candidate = Candidate(user_id=user.id)
        db.add(candidate)

    candidate.full_name = "Candidato Teste"
    candidate.phone = "(11) 99999-2000"
    candidate.city = "Sao Paulo"
    candidate.state = "SP"
    candidate.desired_role = "Frontend Developer"
    candidate.bio = "Profissional com experiencia em React, TypeScript e integracao de APIs."
    candidate.skills = "React, TypeScript, APIs, Tailwind, FastAPI"
    candidate.experience_years = 4
    candidate.salary_expectation = 10000
    candidate.work_mode = "remote"
    candidate.linkedin_url = "https://linkedin.com/in/candidato-teste"
    candidate.portfolio_url = "https://candidato-teste.dev"
    db.flush()
    return candidate


def seed_job(db: Session, company: Company) -> Job:
    job = (
        db.query(Job)
        .filter(Job.company_id == company.id, Job.title == "Frontend Developer React")
        .first()
    )

    if not job:
        job = Job(company_id=company.id, title="Frontend Developer React", description="placeholder")
        db.add(job)

    job.description = "Criar interfaces modernas em React, integrar APIs e colaborar com produto."
    job.requirements = "React, TypeScript, APIs, 3 anos de experiencia"
    job.salary_min = 8000
    job.salary_max = 12000
    job.location = "Sao Paulo"
    job.work_mode = "remote"
    job.status = "approved"
    job.is_active = True
    db.flush()
    return job


def seed_application(db: Session, candidate: Candidate, job: Job) -> Application:
    application = (
        db.query(Application)
        .filter(Application.candidate_id == candidate.id, Application.job_id == job.id)
        .first()
    )

    if not application:
        application = Application(candidate_id=candidate.id, job_id=job.id)
        db.add(application)

    application.cover_letter = "Candidatura teste criada pelo seed local."
    application.status = "submitted"
    db.flush()
    return application


def run_seed() -> None:
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        seed_admin(db)
        company = seed_company(db)
        candidate = seed_candidate(db)
        job = seed_job(db, company)
        seed_application(db, candidate, job)
        db.commit()

    print("AK Talent seed completed.")
    print(f"Admin: {ADMIN_EMAIL} / admin123")
    print(f"Empresa: {COMPANY_EMAIL} / empresa123")
    print(f"Candidato: {CANDIDATE_EMAIL} / candidato123")


if __name__ == "__main__":
    run_seed()
