export interface CandidateProfileAIRequest {
  desired_role: string
  experience: string
  skills: string
  city: string
  work_mode: string
  salary_expectation: string
}

export interface CandidateProfileAIResponse {
  professional_summary: string
  organized_skills: string[]
  suggested_roles: string[]
  profile_improvements: string[]
}

export interface CompanyJobAIRequest {
  role: string
  activities: string
  requirements: string
  salary: string
  city: string
  work_mode: string
}

export interface CompanyJobAIResponse {
  optimized_title: string
  job_description: string
  mandatory_requirements: string[]
  desirable_requirements: string[]
  interview_questions: string[]
}
