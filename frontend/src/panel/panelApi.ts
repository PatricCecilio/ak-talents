import { apiRequest } from '../services/api'
import type { AdminCompany, AdminJob } from '../types/user'
import { jobsQuery, queryString } from './panelFormat'
import type {
  CandidateDetail,
  CandidatesFilters,
  CandidatesListResponse,
  CandidateWritePayload,
  JobsListFilters,
  TeamMemberDetail,
  TeamMemberRow,
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

export function getCandidates(filters: CandidatesFilters): Promise<CandidatesListResponse> {
  return apiRequest<CandidatesListResponse>(`/panel/candidates${queryString(filters)}`)
}

export function getCandidate(candidateId: number): Promise<CandidateDetail> {
  return apiRequest<CandidateDetail>(`/panel/candidates/${candidateId}`)
}

export function updateCandidate(candidateId: number, payload: CandidateWritePayload): Promise<CandidateDetail> {
  return apiRequest<CandidateDetail>(`/panel/candidates/${candidateId}`, { method: 'PUT', body: payload })
}

/** LGPD erasure (admin only). The typed name must match; cannot be undone. */
export function eraseCandidate(candidateId: number, confirmation: string): Promise<{ applications_count: number; files_deleted: number }> {
  return apiRequest<{ applications_count: number; files_deleted: number }>(`/panel/candidates/${candidateId}/erase`, {
    method: 'POST',
    body: { confirmation },
  })
}

export function getTeamMembers(): Promise<TeamMemberRow[]> {
  return apiRequest<TeamMemberRow[]>('/panel/team')
}

export function getTeamMember(userId: number): Promise<TeamMemberDetail> {
  return apiRequest<TeamMemberDetail>(`/panel/team/${userId}`)
}

export function updateTeamMember(userId: number, payload: { name: string; email: string }): Promise<TeamMemberRow> {
  return apiRequest<TeamMemberRow>(`/panel/team/${userId}`, { method: 'PUT', body: payload })
}

export function setTeamMemberActive(userId: number, isActive: boolean): Promise<TeamMemberRow> {
  return apiRequest<TeamMemberRow>(`/panel/team/${userId}/active`, { method: 'PUT', body: { is_active: isActive } })
}

/** Only companies without any job (the API answers 409 otherwise). */
export function deleteCompany(companyId: number): Promise<unknown> {
  return apiRequest<unknown>(`/admin/companies/${companyId}`, { method: 'DELETE' })
}
