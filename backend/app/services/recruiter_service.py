from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.job import Job
from app.models.user import STAFF_ROLES, User


def set_job_responsible(db: Session, job_id: int, recruiter_id: int | None) -> Job:
    """Assign (or clear) the AK team member responsible for a job. Only active staff can be assigned."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga não encontrada.")

    if recruiter_id is not None:
        member = db.query(User).filter(User.id == recruiter_id).first()
        if not member or member.role not in STAFF_ROLES or not member.is_active:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Escolha um recrutador ativo da equipe AK Talent.",
            )

    job.recruiter_id = recruiter_id
    db.commit()
    db.refresh(job)
    return job


def set_company_visibility(db: Session, job_id: int, show: bool) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga não encontrada.")
    job.show_company_to_candidates = show
    db.commit()
    db.refresh(job)
    return job
