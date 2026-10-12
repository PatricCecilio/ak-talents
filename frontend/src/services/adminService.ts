import type {
  AdminApplication,
  AdminCandidate,
  AdminCompany,
  AdminJob,
  AdminJobDetail,
  AdminJobPayload,
  AdminScreeningQuestion,
  CompanyPayload,
  RecruiterCreatePayload,
  StaffMember,
} from '../types/user'
import { apiRequest } from './api'

export function getAdminJobs(includeArchived = false): Promise<AdminJob[]> {
  return apiRequest<AdminJob[]>(`/admin/jobs${includeArchived ? '?include_archived=true' : ''}`)
}

/** Only for a job nobody applied to (the API answers 409 otherwise). Cannot be undone. */
export function deleteAdminJob(jobId: number): Promise<unknown> {
  return apiRequest<unknown>(`/admin/jobs/${jobId}`, { method: 'DELETE' })
}

/** Archive: out of the admin, recruiter and public lists, applications kept. Unarchive: back as "Encerrada". */
export function setJobArchived(jobId: number, archived: boolean): Promise<AdminJob> {
  return apiRequest<AdminJob>(`/admin/jobs/${jobId}/archived`, { method: 'PUT', body: { archived } })
}

/** Client companies are internal records (no login): the admin creates and edits them. */
export function createCompany(payload: CompanyPayload): Promise<AdminCompany> {
  return apiRequest<AdminCompany>('/admin/companies', { method: 'POST', body: payload })
}

export function updateCompany(companyId: number, payload: CompanyPayload): Promise<AdminCompany> {
  return apiRequest<AdminCompany>(`/admin/companies/${companyId}`, { method: 'PUT', body: payload })
}

/** Jobs opened by AK: no approval step; the status (draft / published / closed) is chosen in the form. */
export function createAdminJob(payload: AdminJobPayload): Promise<AdminJob> {
  return apiRequest<AdminJob>('/admin/jobs', { method: 'POST', body: payload })
}

export function getAdminJob(jobId: number): Promise<AdminJobDetail> {
  return apiRequest<AdminJobDetail>(`/admin/jobs/${jobId}`)
}

export function updateAdminJob(jobId: number, payload: AdminJobPayload): Promise<AdminJob> {
  return apiRequest<AdminJob>(`/admin/jobs/${jobId}`, { method: 'PUT', body: payload })
}

export function getJobScreeningQuestions(jobId: number): Promise<AdminScreeningQuestion[]> {
  return apiRequest<AdminScreeningQuestion[]>(`/admin/jobs/${jobId}/screening-questions`)
}

export function updateJobScreeningQuestions(
  jobId: number,
  questions: unknown[],
): Promise<AdminScreeningQuestion[]> {
  return apiRequest<AdminScreeningQuestion[]>(`/admin/jobs/${jobId}/screening-questions`, {
    method: 'PUT',
    body: { questions },
  })
}

export function approveJob(jobId: number): Promise<AdminJob> {
  return apiRequest<AdminJob>(`/admin/jobs/${jobId}/approve`, {
    method: 'PUT',
  })
}

export function hideJob(jobId: number): Promise<AdminJob> {
  return apiRequest<AdminJob>(`/admin/jobs/${jobId}/hide`, {
    method: 'PUT',
  })
}

export function createRecruiter(payload: RecruiterCreatePayload): Promise<StaffMember> {
  return apiRequest<StaffMember>('/admin/recruiters', {
    method: 'POST',
    body: payload,
  })
}

/** Deactivate (never delete) a company: its jobs leave the public and AK lists (and an old login is blocked). */
export function setCompanyActive(companyId: number, isActive: boolean): Promise<AdminCompany> {
  return apiRequest<AdminCompany>(`/admin/companies/${companyId}/active`, {
    method: 'PUT',
    body: { is_active: isActive },
  })
}

/** Deactivate (never delete) a candidate: login blocked (if any) and all applications hidden. */
export function setCandidateActive(candidateId: number, isActive: boolean): Promise<AdminCandidate> {
  return apiRequest<AdminCandidate>(`/admin/candidates/${candidateId}/active`, {
    method: 'PUT',
    body: { is_active: isActive },
  })
}

export function setApplicationHidden(applicationId: number, isHidden: boolean): Promise<AdminApplication> {
  return apiRequest<AdminApplication>(`/admin/applications/${applicationId}/hidden`, {
    method: 'PUT',
    body: { is_hidden: isHidden },
  })
}
