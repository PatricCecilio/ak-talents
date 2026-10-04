from sqlalchemy.orm import Session

from app.core.pipeline import CANDIDATE_STEPS, CANDIDATE_VIEW, Stage, parse_stage
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.user import User
from app.schemas.candidate_pipeline import CandidateApplicationsResponse, CandidateApplicationView


def list_my_applications(db: Session, current_user: User) -> CandidateApplicationsResponse:
    """The signed-in candidate's own applications, with a friendly status only."""
    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.id).first()
    applications = (
        db.query(Application)
        .filter(Application.candidate_id == candidate.id, Application.is_hidden.is_(False))
        .order_by(Application.created_at.desc(), Application.id.desc())
        .all()
        if candidate
        else []
    )

    items = []
    for application in applications:
        label, step, outcome = CANDIDATE_VIEW[parse_stage(application.stage) or Stage.new]
        job = application.job
        items.append(
            CandidateApplicationView(
                id=application.id,
                job_title=job.title,
                job_location=job.location,
                company_name=job.company.company_name if job.show_company_to_candidates else None,
                applied_at=application.created_at,
                updated_at=application.stage_updated_at,
                status_label=label,
                step=step,
                outcome=outcome,
            )
        )
    return CandidateApplicationsResponse(steps=list(CANDIDATE_STEPS), applications=items)
