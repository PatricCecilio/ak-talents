from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

QuestionType = Literal["YES_NO", "SINGLE_SELECT", "TEXT"]
RuleOperator = Literal["EQUALS", "IN"]
ScreeningStatus = Literal["QUALIFIED", "REVIEW", "NOT_MATCHED", "PENDING", "pending_screening"]


class ScreeningOption(BaseModel):
    value: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=180)

    model_config = ConfigDict(extra="forbid")


class ScreeningRule(BaseModel):
    operator: RuleOperator
    value: bool | str | None = None
    values: list[str] | None = None

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_rule_shape(self):
        if self.operator == "EQUALS" and self.value is None:
            raise ValueError("EQUALS requires value")
        if self.operator == "IN" and not self.values:
            raise ValueError("IN requires values")
        return self


class ScreeningQuestionBase(BaseModel):
    key: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=3, max_length=500)
    question_type: QuestionType
    required: bool = False
    options: list[ScreeningOption] | None = None
    rule: ScreeningRule | None = None
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = True

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_question_shape(self):
        if self.question_type == "SINGLE_SELECT" and not self.options:
            raise ValueError("SINGLE_SELECT requires options")
        if self.question_type != "SINGLE_SELECT" and self.options:
            raise ValueError("Only SINGLE_SELECT accepts options")
        if self.question_type == "TEXT" and self.rule:
            raise ValueError("TEXT rules are not supported in this MVP")
        return self


class ScreeningQuestionCreate(ScreeningQuestionBase):
    pass


class ScreeningQuestionRead(ScreeningQuestionBase):
    id: int
    job_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PublicScreeningQuestionRead(BaseModel):
    id: int
    key: str
    label: str
    question_type: QuestionType
    required: bool
    options: list[ScreeningOption] | None = None
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class ScreeningQuestionsUpdate(BaseModel):
    questions: list[ScreeningQuestionCreate]

    model_config = ConfigDict(extra="forbid")


class ScreeningAnswerCreate(BaseModel):
    question_id: int
    value: bool | str

    model_config = ConfigDict(extra="forbid")


class ScreeningSubmitRequest(BaseModel):
    answers: list[ScreeningAnswerCreate]

    model_config = ConfigDict(extra="forbid")


class ScreeningSubmitResponse(BaseModel):
    application_id: int
    screening_status: ScreeningStatus
    screening_score: int
    screening_summary: str


class PublicScreeningJobRead(BaseModel):
    id: int
    title: str
    slug: str
    location: str | None = None
    work_mode: str | None = None


class PublicScreeningRead(BaseModel):
    job: PublicScreeningJobRead
    screening_status: ScreeningStatus
    screening_completed: bool
    questions: list[PublicScreeningQuestionRead]


class AppIntelliScreeningQuestionRead(BaseModel):
    key: str
    question: str
    type: QuestionType
    required: bool
    options: list[ScreeningOption] | None = None
    sort_order: int

    model_config = ConfigDict(extra="forbid")


class AppIntelliScreeningAnswerRead(BaseModel):
    question_key: str
    value: bool | str

    model_config = ConfigDict(extra="forbid")


class AppIntelliScreeningJobRead(BaseModel):
    title: str

    model_config = ConfigDict(extra="forbid")


class AppIntelliScreeningContextRead(BaseModel):
    application_reference: str
    job: AppIntelliScreeningJobRead
    screening_status: ScreeningStatus
    questions: list[AppIntelliScreeningQuestionRead]
    answers: list[AppIntelliScreeningAnswerRead]

    model_config = ConfigDict(extra="forbid")


class AppIntelliScreeningAnswerCreate(BaseModel):
    question_key: str = Field(min_length=1, max_length=120)
    value: bool | str

    model_config = ConfigDict(extra="forbid")


class AppIntelliScreeningSubmitRequest(BaseModel):
    answers: list[AppIntelliScreeningAnswerCreate]

    model_config = ConfigDict(extra="forbid")


class AppIntelliScreeningSubmitResponse(BaseModel):
    application_reference: str
    screening_status: ScreeningStatus
    screening_completed: bool
    missing_required_questions: list[AppIntelliScreeningQuestionRead]

    model_config = ConfigDict(extra="forbid")
