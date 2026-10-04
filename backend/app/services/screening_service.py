from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.job import Job
from app.models.screening import ScreeningAnswer, ScreeningQuestion
from app.models.user import User
from app.schemas.screening import (
    AppIntelliScreeningAnswerRead,
    AppIntelliScreeningContextRead,
    AppIntelliScreeningJobRead,
    AppIntelliScreeningQuestionRead,
    AppIntelliScreeningSubmitRequest,
    AppIntelliScreeningSubmitResponse,
    PublicScreeningRead,
    PublicScreeningQuestionRead,
    ScreeningQuestionCreate,
    ScreeningQuestionRead,
    ScreeningSubmitRequest,
    ScreeningSubmitResponse,
)
from app.services.admin_service import require_staff
from app.services.pipeline_service import advance_after_automated_screening
from app.services.token_service import hash_public_token


QUALIFIED = "QUALIFIED"
REVIEW = "REVIEW"
NOT_MATCHED = "NOT_MATCHED"
PENDING = "PENDING"


def _question_to_read(question: ScreeningQuestion) -> ScreeningQuestionRead:
    return ScreeningQuestionRead(
        id=question.id,
        job_id=question.job_id,
        key=question.key,
        label=question.label,
        question_type=question.question_type,
        required=question.required,
        options=question.options,
        rule=question.rule,
        sort_order=question.sort_order,
        is_active=question.is_active,
        created_at=question.created_at,
    )


def _question_to_public_read(question: ScreeningQuestion) -> PublicScreeningQuestionRead:
    return PublicScreeningQuestionRead(
        id=question.id,
        key=question.key,
        label=question.label,
        question_type=question.question_type,
        required=question.required,
        options=question.options,
        sort_order=question.sort_order,
    )


def _question_to_appintelli_read(question: ScreeningQuestion) -> AppIntelliScreeningQuestionRead:
    return AppIntelliScreeningQuestionRead(
        key=question.key,
        question=question.label,
        type=question.question_type,
        required=question.required,
        options=question.options,
        sort_order=question.sort_order,
    )


def _answer_to_appintelli_read(answer: ScreeningAnswer) -> AppIntelliScreeningAnswerRead:
    value = _answer_value(answer.question, answer)
    return AppIntelliScreeningAnswerRead(
        question_key=answer.question.key,
        value="" if value is None else value,
    )


def list_admin_screening_questions(
    db: Session,
    current_user: User,
    job_id: int,
) -> list[ScreeningQuestionRead]:
    require_staff(current_user)
    return [
        _question_to_read(question)
        for question in db.query(ScreeningQuestion)
        .filter(ScreeningQuestion.job_id == job_id)
        .order_by(ScreeningQuestion.sort_order, ScreeningQuestion.id)
        .all()
    ]


def replace_admin_screening_questions(
    db: Session,
    current_user: User,
    job_id: int,
    questions: list[ScreeningQuestionCreate],
) -> list[ScreeningQuestionRead]:
    require_staff(current_user)
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    existing = db.query(ScreeningQuestion).filter(ScreeningQuestion.job_id == job_id).all()
    for question in existing:
        db.delete(question)

    db.flush()

    created_questions: list[ScreeningQuestion] = []
    for index, payload in enumerate(questions):
        question = ScreeningQuestion(
            job_id=job_id,
            key=payload.key,
            label=payload.label,
            question_type=payload.question_type,
            required=payload.required,
            options=[option.model_dump() for option in payload.options] if payload.options else None,
            rule=payload.rule.model_dump(exclude_none=True) if payload.rule else None,
            sort_order=payload.sort_order if payload.sort_order is not None else index,
            is_active=payload.is_active,
        )
        db.add(question)
        created_questions.append(question)

    db.commit()

    for question in created_questions:
        db.refresh(question)

    return [_question_to_read(question) for question in created_questions]


def list_public_screening_questions(db: Session, job_id: int) -> list[PublicScreeningQuestionRead]:
    questions = (
        db.query(ScreeningQuestion)
        .filter(ScreeningQuestion.job_id == job_id, ScreeningQuestion.is_active.is_(True))
        .order_by(ScreeningQuestion.sort_order, ScreeningQuestion.id)
        .all()
    )
    return [_question_to_public_read(question) for question in questions]


def _is_missing_answer(question: ScreeningQuestion, answer: ScreeningAnswer | None) -> bool:
    if answer is None:
        return True
    if question.question_type == "YES_NO":
        return answer.value_bool is None
    if question.question_type == "SINGLE_SELECT":
        return not answer.value_select
    return not (answer.value_text or "").strip()


def _answer_value(question: ScreeningQuestion, answer: ScreeningAnswer) -> bool | str | None:
    if question.question_type == "YES_NO":
        return answer.value_bool
    if question.question_type == "SINGLE_SELECT":
        return answer.value_select
    return answer.value_text


def _rule_matches(rule: dict, value: bool | str | None) -> bool:
    operator = rule.get("operator")
    if operator == "EQUALS":
        return value == rule.get("value")
    if operator == "IN":
        return value in (rule.get("values") or [])
    return False


def get_application_by_public_token(db: Session, token: str) -> Application:
    application = (
        db.query(Application)
        .filter(Application.public_screening_token_hash == hash_public_token(token))
        .first()
    )
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screening not found")
    return application


def get_application_by_appintelli_reference(db: Session, reference: str) -> Application:
    application = db.query(Application).filter(Application.appintelli_reference == reference).first()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screening not found")
    return application


def _active_questions_for_job(db: Session, job_id: int) -> list[ScreeningQuestion]:
    return (
        db.query(ScreeningQuestion)
        .filter(ScreeningQuestion.job_id == job_id, ScreeningQuestion.is_active.is_(True))
        .order_by(ScreeningQuestion.sort_order, ScreeningQuestion.id)
        .all()
    )


def _missing_required_questions(
    questions: list[ScreeningQuestion],
    answers_by_question_id: dict[int, ScreeningAnswer],
) -> list[AppIntelliScreeningQuestionRead]:
    return [
        _question_to_appintelli_read(question)
        for question in questions
        if question.required and _is_missing_answer(question, answers_by_question_id.get(question.id))
    ]


def _evaluate_screening(
    application: Application,
    questions: list[ScreeningQuestion],
    answers_by_question_id: dict[int, ScreeningAnswer],
) -> None:
    if not questions:
        application.screening_status = REVIEW
        application.screening_score = 0
        application.screening_summary = "Nenhuma pergunta de triagem configurada para esta vaga."
        application.screening_completed_at = datetime.now(timezone.utc)
        return

    failed_required = 0
    failed_rules = 0
    passed_rules = 0
    total_rules = 0

    for question in questions:
        answer = answers_by_question_id.get(question.id)
        if question.required and _is_missing_answer(question, answer):
            failed_required += 1
            continue
        if question.rule:
            total_rules += 1
            if answer is None or not _rule_matches(question.rule, _answer_value(question, answer)):
                failed_rules += 1
            else:
                passed_rules += 1

    if failed_required:
        screening_status = PENDING
    elif failed_rules:
        screening_status = NOT_MATCHED
    elif total_rules == 0:
        screening_status = REVIEW
    else:
        screening_status = QUALIFIED

    screening_score = round((passed_rules / total_rules) * 100) if total_rules else 0
    summary = (
        f"Resultado deterministico: {screening_status}. "
        f"Regras aprovadas: {passed_rules}/{total_rules}. "
        f"Obrigatorias sem resposta: {failed_required}."
    )

    application.screening_status = screening_status
    application.screening_score = screening_score
    application.screening_summary = summary
    application.screening_completed_at = (
        None if screening_status == PENDING else datetime.now(timezone.utc)
    )


def _evaluate_and_advance(
    db: Session,
    application: Application,
    questions: list[ScreeningQuestion],
    answers_by_question_id: dict[int, ScreeningAnswer],
) -> None:
    """Evaluate the screening and, once it is complete, hand the application to the AK team."""
    _evaluate_screening(application, questions, answers_by_question_id)
    if application.screening_status != PENDING:
        advance_after_automated_screening(db, application, application.screening_status)


def get_public_screening(db: Session, token: str) -> PublicScreeningRead:
    application = get_application_by_public_token(db, token)
    job = application.job
    return PublicScreeningRead(
        job={
            "id": job.id,
            "title": job.title,
            "slug": job.slug,
            "location": job.location,
            "work_mode": job.work_mode,
        },
        screening_status=application.screening_status,
        screening_completed=application.screening_completed_at is not None,
        questions=list_public_screening_questions(db, application.job_id),
    )


def _make_answer(question: ScreeningQuestion, raw_value: bool | str) -> ScreeningAnswer:
    if question.question_type == "YES_NO":
        if not isinstance(raw_value, bool):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid YES_NO answer")
        return ScreeningAnswer(question_id=question.id, value_bool=raw_value)

    if question.question_type == "SINGLE_SELECT":
        if not isinstance(raw_value, str):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid SINGLE_SELECT answer")
        option_values = {option["value"] for option in (question.options or [])}
        if raw_value not in option_values:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid option")
        return ScreeningAnswer(question_id=question.id, value_select=raw_value)

    if not isinstance(raw_value, str):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid TEXT answer")
    return ScreeningAnswer(question_id=question.id, value_text=raw_value.strip())


def _submit_screening_answers_for_application(
    db: Session,
    application: Application,
    payload: ScreeningSubmitRequest,
) -> ScreeningSubmitResponse:
    questions = (
        db.query(ScreeningQuestion)
        .filter(ScreeningQuestion.job_id == application.job_id, ScreeningQuestion.is_active.is_(True))
        .order_by(ScreeningQuestion.sort_order, ScreeningQuestion.id)
        .all()
    )
    if not questions:
        _evaluate_and_advance(db, application, questions, {})
        db.commit()
        return ScreeningSubmitResponse(
            application_id=application.id,
            screening_status=application.screening_status,
            screening_score=application.screening_score or 0,
            screening_summary=application.screening_summary or "",
        )

    question_by_id = {question.id: question for question in questions}
    submitted_question_ids = [answer.question_id for answer in payload.answers]
    unknown_ids = set(submitted_question_ids).difference(question_by_id)
    if unknown_ids:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid question")

    existing_answers = db.query(ScreeningAnswer).filter(ScreeningAnswer.application_id == application.id).all()
    for answer in existing_answers:
        db.delete(answer)
    db.flush()

    answers_by_question_id: dict[int, ScreeningAnswer] = {}
    for submitted_answer in payload.answers:
        question = question_by_id[submitted_answer.question_id]
        answer = _make_answer(question, submitted_answer.value)
        answer.application_id = application.id
        db.add(answer)
        answers_by_question_id[question.id] = answer

    _evaluate_and_advance(db, application, questions, answers_by_question_id)
    db.commit()

    return ScreeningSubmitResponse(
        application_id=application.id,
        screening_status=application.screening_status,
        screening_score=application.screening_score or 0,
        screening_summary=application.screening_summary or "",
    )


def submit_screening_answers_by_token(
    db: Session,
    token: str,
    payload: ScreeningSubmitRequest,
) -> ScreeningSubmitResponse:
    return _submit_screening_answers_for_application(db, get_application_by_public_token(db, token), payload)


def get_appintelli_screening_context(db: Session, reference: str) -> AppIntelliScreeningContextRead:
    application = get_application_by_appintelli_reference(db, reference)
    questions = _active_questions_for_job(db, application.job_id)
    answers = (
        db.query(ScreeningAnswer)
        .join(ScreeningQuestion, ScreeningAnswer.question_id == ScreeningQuestion.id)
        .filter(ScreeningAnswer.application_id == application.id, ScreeningQuestion.job_id == application.job_id)
        .order_by(ScreeningQuestion.sort_order, ScreeningQuestion.id)
        .all()
    )
    return AppIntelliScreeningContextRead(
        application_reference=application.appintelli_reference,
        job=AppIntelliScreeningJobRead(title=application.job.title),
        screening_status=application.screening_status,
        questions=[_question_to_appintelli_read(question) for question in questions],
        answers=[_answer_to_appintelli_read(answer) for answer in answers],
    )


def submit_appintelli_screening_answers(
    db: Session,
    reference: str,
    payload: AppIntelliScreeningSubmitRequest,
) -> AppIntelliScreeningSubmitResponse:
    application = get_application_by_appintelli_reference(db, reference)
    questions = _active_questions_for_job(db, application.job_id)
    question_keys = [question.key for question in questions]
    if len(set(question_keys)) != len(question_keys):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invalid screening configuration")

    submitted_keys = [answer.question_key for answer in payload.answers]
    if len(set(submitted_keys)) != len(submitted_keys):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Duplicate question")

    question_by_key = {question.key: question for question in questions}
    prepared_answers: dict[int, ScreeningAnswer] = {}
    for submitted_answer in payload.answers:
        question = question_by_key.get(submitted_answer.question_key)
        if not question:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid question")
        prepared_answers[question.id] = _make_answer(question, submitted_answer.value)

    existing_answers = {
        answer.question_id: answer
        for answer in db.query(ScreeningAnswer).filter(ScreeningAnswer.application_id == application.id).all()
    }

    for question_id, prepared_answer in prepared_answers.items():
        existing_answer = existing_answers.get(question_id)
        if existing_answer:
            existing_answer.value_bool = prepared_answer.value_bool
            existing_answer.value_select = prepared_answer.value_select
            existing_answer.value_text = prepared_answer.value_text
        else:
            prepared_answer.application_id = application.id
            db.add(prepared_answer)
            existing_answers[question_id] = prepared_answer

    _evaluate_and_advance(db, application, questions, existing_answers)
    db.commit()

    return AppIntelliScreeningSubmitResponse(
        application_reference=application.appintelli_reference,
        screening_status=application.screening_status,
        screening_completed=application.screening_completed_at is not None,
        missing_required_questions=_missing_required_questions(questions, existing_answers),
    )
