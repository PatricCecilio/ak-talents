import { apiRequest } from '../services/api'
import type { AdminCompany, AdminJob } from '../types/user'
import { jobsQuery } from './panelFormat'
import type {
  JobsListFilters,
  JobsListResponse,
  ManualCandidatePayload,
  OverviewResponse,
  PanelJobDetail,
  SearchResponse,
} from './types'

export function getOverview(): Promise<OverviewResponse> {
  return apiRequest<OverviewResponse>('/panel/overview')
}

export function getPanelJobs(filters: JobsListFilters): Promise<JobsListResponse> {
  return apiRequest<JobsListResponse>(`/panel/jobs${jobsQuery(filters)}`)
}

export function getPanelJob(jobId: number): Promise<PanelJobDetail> {
  return apiRequest<PanelJobDetail>(`/panel/jobs/${jobId}`)
}

/** Admin only (the API refuses recruiters). */
export function assignResponsible(jobId: number, recruiterId: number | null): Promise<AdminJob> {
  return apiRequest<AdminJob>(`/panel/jobs/${jobId}/responsible`, { method: 'PUT', body: { recruiter_id: recruiterId } })
}

export function getPanelCompanies(): Promise<AdminCompany[]> {
  return apiRequest<AdminCompany[]>('/panel/companies')
}

export function searchPanel(text: string): Promise<SearchResponse> {
  return apiRequest<SearchResponse>(`/panel/search?q=${encodeURIComponent(text)}`)
}

export function createManualCandidate(payload: ManualCandidatePayload): Promise<{ id: number }> {
  return apiRequest<{ id: number }>('/panel/candidates', { method: 'POST', body: payload })
}

export function referToJob(applicationId: number, jobId: number): Promise<{ application_id: number; job_id: number }> {
  return apiRequest(`/panel/applications/${applicationId}/refer`, { method: 'POST', body: { job_id: jobId } })
}
