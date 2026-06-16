from pydantic import BaseModel, Field


class CandidateMatchRead(BaseModel):
    candidate_id: int
    name: str
    score: int = Field(ge=0, le=100)
    reasons: list[str]
