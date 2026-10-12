"""Which jobs each AK team member works on.

Admin: every job. Recruiter: only the jobs where they are the responsible recruiter; a job without a
responsible belongs to the admin. Anything outside that scope answers 404, as if it did not exist, so ids of
other people's jobs, applications and candidates reveal nothing.
"""

from fastapi import HTTPException, status
from sqlalchemy import and_
from sqlalchemy.orm import Query, Session

from app.core import messages
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.user import User, UserRole

APPLICATION_NOT_FOUND = "Candidatura não encontrada."


def is_restricted(actor: User) -> bool:
    """Recruiters only see their own jobs; the admin sees everything."""
    return actor.role != UserRole.admin.value


def scope_jobs(query: Query, actor: User) -> Query:
    """Filter a query that selects (or joins) Job to the jobs the actor may see."""
    if is_restricted(actor):
        query = query.filter(Job.recruiter_id == actor.id)
    return query


def visible_job_ids(db: Session, actor: User) -> set[int] | None:
    """Ids of the actor's jobs, or None for "every job" (admin)."""
    if not is_restricted(actor):
        return None
    return {job_id for (job_id,) in db.query(Job.id).filter(Job.recruiter_id == actor.id).all()}


def can_see_job(actor: User, job: Job) -> bool:
    return not is_restricted(actor) or job.recruiter_id == actor.id


def job_for(db: Session, actor: User, job_id: int) -> Job:
    job = db.get(Job, job_id)
    if job is None or not can_see_job(actor, job):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=messages.JOB_NOT_FOUND)
    return job


def application_for(db: Session, actor: User, application_id: int) -> Application:
    application = db.get(Application, application_id)
    if application is None or not can_see_job(actor, application.job):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=APPLICATION_NOT_FOUND)
    return application


def applications_in_scope(candidate: Candidate, job_ids: set[int] | None) -> list[Application]:
    """The candidate's applications the actor may see: all for the admin; for a recruiter, the ones in their jobs
    that the admin did not hide."""
    if job_ids is None:
        return list(candidate.applications)
    return [application for application in candidate.applications if application.job_id in job_ids and not application.is_hidden]


def has_application_in(job_ids: set[int]):
    """Filter for Candidate queries: people with a (not hidden) application in one of these jobs."""
    return Candidate.applications.any(and_(Application.job_id.in_(job_ids), Application.is_hidden.is_(False)))


def ensure_candidate(candidate: Candidate, job_ids: set[int] | None) -> None:
    """A recruiter only reaches people who applied (or were added) to one of their jobs."""
    if job_ids is not None and not applications_in_scope(candidate, job_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=messages.CANDIDATE_NOT_FOUND)
