export interface CompanyFinalist {
  application_id: number
  job_id: number
  job_title: string
  candidate_name: string
  city: string | null
  experience_years: number | null
  finalist_summary: string | null
  status: 'pending' | 'approved'
  updated_at: string
  /** Only present after the company approves the finalist. */
  phone: string | null
  email: string | null
}

export interface CompanyFinalistsResponse {
  pending: CompanyFinalist[]
  approved: CompanyFinalist[]
}

export type FinalistDecisionValue = 'approve' | 'reject'
