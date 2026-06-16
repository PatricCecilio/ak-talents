from pydantic import BaseModel, Field


class CandidateProfileAIRequest(BaseModel):
    desired_role: str = Field(min_length=2, max_length=180)
    experience: str = Field(min_length=2, max_length=5000)
    skills: str = Field(min_length=2, max_length=3000)
    city: str = Field(min_length=2, max_length=180)
    work_mode: str = Field(min_length=2, max_length=80)
    salary_expectation: str = Field(min_length=1, max_length=120)


class CandidateProfileAIResponse(BaseModel):
    professional_summary: str
    organized_skills: list[str]
    suggested_roles: list[str]
    profile_improvements: list[str]


class CompanyJobAIRequest(BaseModel):
    role: str = Field(min_length=2, max_length=180)
    activities: str = Field(min_length=2, max_length=5000)
    requirements: str = Field(min_length=2, max_length=5000)
    salary: str = Field(min_length=1, max_length=120)
    city: str = Field(min_length=2, max_length=180)
    work_mode: str = Field(min_length=2, max_length=80)


class CompanyJobAIResponse(BaseModel):
    optimized_title: str
    job_description: str
    mandatory_requirements: list[str]
    desirable_requirements: list[str]
    interview_questions: list[str]
