export type StageValue =
  | 'new'
  | 'screening'
  | 'ak_interview'
  | 'finalist'
  | 'client_approved'
  | 'hired'
  | 'rejected'
  | 'withdrawn'

export interface StageOption {
  value: StageValue
  label: string
}

export interface RecruiterJobSummary {
  id: number
  title: string
  company_name: string
  location: string | null
  status: string
  is_active: boolean
  recruiter_id: number | null
  recruiter_name: string | null
  stage_counts: Record<StageValue, number>
  active_count: number
  finalists_waiting: number
}

export interface RecruiterJobsResponse {
  finalist_alert_days: number
  jobs: RecruiterJobSummary[]
}

export interface ApplicationCard {
  id: number
  candidate_name: string
  city: string | null
  neighborhood: string | null
  stage: StageValue
  stage_label: string
  stage_updated_at: string
  screening_status: string
  screening_score: number | null
  created_at: string
  waiting_client_too_long: boolean
  allowed_next_stages: StageOption[]
}

export interface JobPipelineResponse {
  finalist_alert_days: number
  job: RecruiterJobSummary
  applications: ApplicationCard[]
}

export interface StageHistoryEntry {
  from_stage: StageValue | null
  from_stage_label: string | null
  to_stage: StageValue
  to_stage_label: string
  changed_by_name: string | null
  changed_by_role: string
  note: string | null
  created_at: string
}

export interface ApplicationNote {
  id: number
  body: string
  author_name: string | null
  created_at: string
}

export interface ApplicationDetail {
  id: number
  job_id: number
  job_title: string
  company_name: string
  created_at: string
  stage: StageValue
  stage_label: string
  stage_updated_at: string
  finalist_summary: string | null
  cover_letter: string | null
  is_hidden: boolean
  candidate: {
    name: string
    email: string | null
    phone: string | null
    city: string | null
    neighborhood: string | null
    desired_role: string | null
    experience_years: number | null
    skills: string | null
    linkedin_url: string | null
    portfolio_url: string | null
    has_account: boolean
  }
  screening: {
    status: string
    score: number | null
    summary: string | null
    completed_at: string | null
    answers: Array<{ question: string; answer: string }>
  }
  history: StageHistoryEntry[]
  notes: ApplicationNote[]
  allowed_next_stages: StageOption[]
  other_active_count: number
}

export interface StageMovePayload {
  to_stage: StageValue
  note?: string
  finalist_summary?: string
  close_other_active?: boolean
}

export interface StageMoveResponse {
  application_id: number
  stage: StageValue
  stage_label: string
  stage_updated_at: string
  allowed_next_stages: StageOption[]
  closed_others_count: number
}
