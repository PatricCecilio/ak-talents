export type UserRole = 'candidate' | 'company' | 'admin' | 'recruiter'

/** Internal AK Talent team (operates jobs and applications). */
export const STAFF_ROLES: UserRole[] = ['admin', 'recruiter']

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload extends LoginPayload {
  name: string
  role: UserRole
  company_name?: string
  privacy_accepted: boolean
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface Job {
  id: number
  company_id?: number
  slug: string
  title: string
  description: string
  requirements: string | null
  salary_min: number | null
  salary_max: number | null
  location: string | null
  work_mode: string | null
  status?: string
  is_active?: boolean
  created_at: string
  screening_questions?: PublicScreeningQuestion[]
  /** Company view only: number of applications per pipeline stage (no names). */
  stage_counts?: Record<string, number>
}

export interface JobPayload {
  title: string
  description: string
  requirements?: string
  salary_min?: number | null
  salary_max?: number | null
  location?: string
  work_mode?: string
}

export interface Application {
  id: number
  candidate_id: number
  job_id: number
  cover_letter: string | null
  status: string
  privacy_accepted_at?: string | null
  created_at: string
}

export interface ApplicationPayload {
  job_id: number
  cover_letter?: string
}

export interface PublicApplicationPayload {
  full_name: string
  email: string
  phone: string
  city: string
  neighborhood: string
  privacy_accepted: boolean
}

export interface PublicApplicationResponse {
  status: string
  screening_status: string
  public_screening_token: string
  application_reference: string
  message: string
  screening_completed: boolean
}

export type ScreeningQuestionType = 'YES_NO' | 'SINGLE_SELECT' | 'TEXT'

export interface ScreeningOption {
  value: string
  label: string
}

export interface ScreeningRule {
  operator: 'EQUALS' | 'IN'
  value?: boolean | string
  values?: string[]
}

export interface PublicScreeningQuestion {
  id: number
  key: string
  label: string
  question_type: ScreeningQuestionType
  required: boolean
  options?: ScreeningOption[] | null
  sort_order: number
}

export interface AdminScreeningQuestion extends PublicScreeningQuestion {
  job_id: number
  rule?: ScreeningRule | null
  is_active: boolean
  created_at: string
}

export interface ScreeningAnswerPayload {
  question_id: number
  value: boolean | string
}

export interface ScreeningSubmitPayload {
  answers: ScreeningAnswerPayload[]
}

export interface ScreeningSubmitResponse {
  application_id: number
  screening_status: 'QUALIFIED' | 'REVIEW' | 'NOT_MATCHED' | 'PENDING' | 'NO_QUESTIONS'
  screening_score: number | null
  screening_summary: string
}

export interface PublicScreeningResponse {
  job: {
    id: number
    title: string
    slug: string
    location: string | null
    work_mode: string | null
  }
  screening_status: 'QUALIFIED' | 'REVIEW' | 'NOT_MATCHED' | 'PENDING' | 'pending_screening'
  screening_completed: boolean
  questions: PublicScreeningQuestion[]
}

export interface CandidateMatch {
  candidate_id: number
  name: string
  score: number
  reasons: string[]
}

export interface CandidateProfile {
  id: number
  user_id: number
  full_name: string | null
  phone: string | null
  city: string | null
  state: string | null
  desired_role: string | null
  professional_summary: string | null
  skills: string | null
  experience_years: number | null
  salary_expectation: number | null
  work_mode: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  created_at: string
}

export interface CandidateProfilePayload {
  full_name?: string | null
  phone?: string | null
  city?: string | null
  state?: string | null
  desired_role?: string | null
  professional_summary?: string | null
  skills?: string | null
  experience_years?: number | null
  salary_expectation?: number | null
  work_mode?: string | null
  linkedin_url?: string | null
  portfolio_url?: string | null
}

export interface CompanyProfile {
  id: number
  user_id: number
  company_name: string
  responsible_name: string | null
  phone: string | null
  city: string | null
  state: string | null
  industry: string | null
  company_size: string | null
  status: string
  description: string | null
  website_url: string | null
  created_at: string
}

export interface CompanyProfilePayload {
  company_name?: string | null
  responsible_name?: string | null
  phone?: string | null
  city?: string | null
  state?: string | null
  industry?: string | null
  company_size?: string | null
  description?: string | null
  website_url?: string | null
}

export interface AdminUser {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface AdminCandidate {
  id: number
  user_id: number | null
  name: string
  email: string | null
  phone: string | null
  city: string | null
  neighborhood: string | null
  desired_role: string | null
  skills: string | null
  experience_years: number | null
  salary_expectation: number | null
  work_mode: string | null
  created_at: string
  is_active?: boolean
}

export interface AdminCompany {
  id: number
  user_id: number
  company_name: string
  responsible_name: string | null
  email: string
  city: string | null
  state: string | null
  industry: string | null
  company_size: string | null
  status: string
  created_at: string
  is_active?: boolean
}

export interface AdminJob {
  id: number
  company_id: number
  company_name: string
  title: string
  location: string | null
  work_mode: string | null
  status: string
  is_active: boolean
  created_at: string
  recruiter_id?: number | null
  recruiter_name?: string | null
}

export interface StaffMember {
  id: number
  name: string
  email: string
  role: 'admin' | 'recruiter'
  is_active: boolean
  created_at: string
}

export interface RecruiterCreatePayload {
  name: string
  email: string
  password: string
}

export interface AdminApplication {
  id: number
  candidate_id: number
  candidate_name: string
  candidate_phone: string | null
  candidate_city: string | null
  candidate_neighborhood: string | null
  job_id: number
  job_title: string
  status: string
  screening_status: string
  screening_score: number | null
  screening_summary: string | null
  created_at: string
  is_hidden?: boolean
  stage?: string
  stage_label?: string
}
