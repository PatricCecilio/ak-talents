import type { StageValue } from '../types/pipeline'

export interface PanelJobRow {
  id: number
  title: string
  slug: string
  company_id: number
  company_name: string
  location: string | null
  recruiter_id: number | null
  recruiter_name: string | null
  status: string
  openings: number | null
  applications: number
  to_triage: number
  with_client: number
  waiting_client_too_long: number
  published_at: string | null
  created_at: string
  company_is_active: boolean
}

export interface PanelJobDetail extends PanelJobRow {
  description: string
  requirements: string | null
  salary_min: number | null
  salary_max: number | null
  work_mode: string | null
  schedule: string | null
  benefits: string | null
  contract_type: string | null
  show_company_to_candidates: boolean
  closed_at: string | null
}

export interface StageCount {
  stage: StageValue
  label: string
  count: number
}

export interface ActivityItem {
  kind: 'new_application' | 'sent_to_client' | 'client_approved' | 'client_rejected' | 'hired' | 'job_published'
  title: string
  detail: string
  at: string
  job_id: number | null
  application_id: number | null
}

export interface OverviewResponse {
  scope: 'all' | 'mine'
  alert_days: number
  cards: {
    to_triage: number
    to_triage_last_24h: number
    waiting_client: number
    waiting_client_too_long: number
    jobs_without_candidates: number
    hires_this_month: number
    jobs_in_progress: number
  }
  stage_counts: StageCount[]
  jobs_summary: { approved: number; draft: number; closed: number; archived: number; active_companies: number }
  activity: ActivityItem[]
  jobs_in_progress: PanelJobRow[]
}

export interface PageInfo {
  total: number
  page: number
  page_size: number
}

export interface JobsListResponse extends PageInfo {
  items: PanelJobRow[]
  archived_hidden: number
}

export interface JobsListFilters {
  status?: string
  company_id?: number
  recruiter_id?: number
  no_recruiter?: boolean
  mine?: boolean
  include_archived?: boolean
  focus?: 'to_triage' | 'with_client' | 'empty'
  page?: number
}

export interface SearchHit {
  kind: 'candidate' | 'job' | 'company'
  id: number
  title: string
  detail: string
}

export interface SearchResponse {
  candidates: SearchHit[]
  jobs: SearchHit[]
  companies: SearchHit[]
}

export interface ManualCandidatePayload {
  full_name: string
  phone: string
  city: string
  email: string | null
  authorization_confirmed: boolean
  job_id?: number | null
}

export interface CandidateRow {
  id: number
  name: string
  email: string | null
  phone: string | null
  city: string | null
  latest_stage: StageValue | null
  latest_stage_label: string
  applications: number
  has_account: boolean
  source: string | null
  is_active?: boolean
}

export interface CandidatesListResponse extends PageInfo {
  items: CandidateRow[]
  cities: string[]
}

export interface CandidatesFilters {
  stage?: string
  job_id?: number
  city?: string
  q?: string
  page?: number
}

export interface CandidateApplicationRow {
  id: number
  job_id: number
  job_title: string
  company_name: string
  stage: StageValue
  stage_label: string
  created_at: string
  stage_updated_at: string
  is_hidden: boolean
}

export interface CandidateDetail {
  id: number
  name: string
  email: string | null
  phone: string | null
  city: string | null
  neighborhood: string | null
  state: string | null
  desired_role: string | null
  experience_years: number | null
  skills: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  resume_url: string | null
  has_account: boolean
  source: string | null
  source_label: string
  created_by_name: string | null
  authorization_recorded_at: string | null
  created_at: string
  is_active?: boolean
  applications: CandidateApplicationRow[]
}

export interface CandidateWritePayload {
  full_name: string
  phone: string
  city: string
  email: string | null
  neighborhood: string | null
  state: string | null
  desired_role: string | null
  experience_years: number | null
  skills: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  resume_url: string | null
}

export interface TeamMemberRow {
  id: number
  name: string
  email: string
  role: 'admin' | 'recruiter'
  role_label: string
  is_active: boolean
  active_jobs: number
  candidates_in_progress: number
  hires_this_month: number
  last_activity_at: string | null
}

export interface TeamMemberDetail {
  member: TeamMemberRow
  cards: {
    active_jobs: number
    closed_this_month: number
    to_triage: number
    oldest_to_triage_at: string | null
    with_client: number
    oldest_with_client_at: string | null
    hires_this_month: number
    average_days_to_hire: number | null
  }
  jobs: Array<{ id: number; title: string; company_name: string; status: string; published_at: string | null; stage_counts: Record<string, number> }>
  notes: Array<{ id: number; application_id: number; candidate_name: string; job_title: string; kind: string; kind_label: string; body: string; created_at: string }>
}
