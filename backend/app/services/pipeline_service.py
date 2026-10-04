from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.pipeline import (
    ACTIVE_STAGES,
    AK_TRANSITIONS,
    COMPANY_TRANSITIONS,
    FILLED_JOB_NOTE,
    STAGE_LABELS,
    SYSTEM_ROLE,
    Stage,
    parse_stage,
)
from app.models.application import Application
from app.models.pipeline import ApplicationNote, ApplicationStageHistory
from app.models.user import STAFF_ROLES, User, UserRole

MAX_NOTE_LENGTH = 2000
SCREENING_RESULT_LABELS = {
    "QUALIFIED": "atende aos requisitos",
    "NOT_MATCHED": "não atende a algum requisito",
    "REVIEW": "para análise da equipe",
}
FINALIST_SUMMARY_REQUIRED = "Escreva um parecer curto para a empresa antes de enviar o finalista."


def _now() -> datetime:
    return datetime.now(timezone.utc)


def allowed_next_stages(application: Application, actor_role: str) -> list[Stage]:
    current = parse_stage(application.stage)
    if current is None:
        return []
    if actor_role in STAFF_ROLES:
        return list(AK_TRANSITIONS.get(current, ()))
    if actor_role == UserRole.company.value:
        return list(COMPANY_TRANSITIONS.get(current, ()))
    return []


def record_initial_stage(db: Session, application: Application, note: str | None = None) -> None:
    """History entry for a brand-new application (call after it has an id; does not commit)."""
    application.stage = Stage.new.value
    application.stage_updated_at = _now()
    db.add(
        ApplicationStageHistory(
            application_id=application.id,
            from_stage=None,
            to_stage=Stage.new.value,
            changed_by_user_id=None,
            changed_by_role=SYSTEM_ROLE,
            note=note,
        )
    )


def _apply(db: Session, application: Application, to_stage: Stage, actor: User | None, note: str | None) -> None:
    db.add(
        ApplicationStageHistory(
            application_id=application.id,
            from_stage=application.stage,
            to_stage=to_stage.value,
            changed_by_user_id=actor.id if actor else None,
            changed_by_role=actor.role if actor else SYSTEM_ROLE,
            note=(note or "").strip() or None,
        )
    )
    application.stage = to_stage.value
    application.stage_updated_at = _now()


def advance_after_automated_screening(db: Session, application: Application, screening_status: str) -> None:
    """Automated screening finished: a "new" application moves to "screening" for the AK team (no commit)."""
    if application.stage == Stage.new.value:
        result = SCREENING_RESULT_LABELS.get(screening_status, screening_status)
        _apply(db, application, Stage.screening, None, f"Triagem automática concluída: {result}.")


def move_application(
    db: Session,
    application: Application,
    to_stage_value: str,
    actor: User,
    note: str | None = None,
    finalist_summary: str | None = None,
    close_other_active: bool = False,
) -> int:
    """Move one application, enforcing who may do what. Returns how many other applications were closed."""
    to_stage = parse_stage(to_stage_value)
    if to_stage is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Etapa inválida.")

    if note and len(note) > MAX_NOTE_LENGTH:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A observação está muito longa.")

    if to_stage not in allowed_next_stages(application, actor.role):
        current = parse_stage(application.stage)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Não é possível mover de \"{STAGE_LABELS.get(current, application.stage)}\" para \"{STAGE_LABELS[to_stage]}\".",
        )

    if to_stage == Stage.finalist:
        summary = (finalist_summary or "").strip()
        if not summary:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=FINALIST_SUMMARY_REQUIRED)
        if len(summary) > MAX_NOTE_LENGTH:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="O parecer está muito longo.")
        application.finalist_summary = summary

    if close_other_active and to_stage != Stage.hired:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Só é possível encerrar os demais candidatos ao marcar alguém como contratado.",
        )

    _apply(db, application, to_stage, actor, note)

    closed = 0
    if close_other_active:
        others = (
            db.query(Application)
            .filter(
                Application.job_id == application.job_id,
                Application.id != application.id,
                Application.is_hidden.is_(False),
                Application.stage.in_([stage.value for stage in ACTIVE_STAGES]),
            )
            .all()
        )
        for other in others:
            _apply(db, other, Stage.rejected, actor, FILLED_JOB_NOTE)
        closed = len(others)

    db.commit()
    db.refresh(application)
    return closed


def add_note(db: Session, application: Application, author: User, body: str) -> ApplicationNote:
    text = (body or "").strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Escreva a nota antes de salvar.")
    if len(text) > MAX_NOTE_LENGTH:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A nota está muito longa.")
    note = ApplicationNote(application_id=application.id, author_user_id=author.id, body=text)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def get_application_or_404(db: Session, application_id: int) -> Application:
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidatura não encontrada.")
    return application
