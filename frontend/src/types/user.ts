export type UserRole = 'candidate' | 'company' | 'admin'

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
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface Job {
  id: number
  company_id: number
  title: string
  description: string
  requirements: string | null
  salary_min: number | null
  salary_max: number | null
  location: string | null
  work_mode: string | null
  status: string
  is_active: boolean
  created_at: string
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
  created_at: string
}

export interface ApplicationPayload {
  job_id: number
  cover_letter?: string
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
  user_id: number
  name: string
  email: string
  city: string | null
  desired_role: string | null
  skills: string | null
  experience_years: number | null
  salary_expectation: number | null
  work_mode: string | null
  created_at: string
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
}

export interface AdminApplication {
  id: number
  candidate_id: number
  candidate_name: string
  job_id: number
  job_title: string
  status: string
  created_at: string
}
