export interface CandidateApplicationView {
  id: number
  job_title: string
  job_location: string | null
  /** Only when the job is set to show the client company name. */
  company_name: string | null
  applied_at: string
  updated_at: string
  status_label: string
  /** 1..4 on the timeline; null when the process is closed. */
  step: number | null
  outcome: 'in_progress' | 'hired' | 'closed'
}

export interface CandidateApplicationsResponse {
  steps: string[]
  applications: CandidateApplicationView[]
}
