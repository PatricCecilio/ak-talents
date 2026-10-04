import type { AdminApplication, AdminCandidate, AdminCompany, AdminJob, AdminScreeningQuestion, AdminUser, RecruiterCreatePayload, StaffMember } from '../types/user'
import { apiRequest } from './api'

export function getAdminUsers(): Promise<AdminUser[]> {
  return apiRequest<AdminUser[]>('/admin/users')
}

export function getAdminCandidates(): Promise<AdminCandidate[]> {
  return apiRequest<AdminCandidate[]>('/admin/candidates')
}

export function getAdminCompanies(): Promise<AdminCompany[]> {
  return apiRequest<AdminCompany[]>('/admin/companies')
}

export function getAdminJobs(): Promise<AdminJob[]> {
  return apiRequest<AdminJob[]>('/admin/jobs')
}

export function getAdminApplications(includeHidden = false): Promise<AdminApplication[]> {
  return apiRequest<AdminApplication[]>(`/admin/applications${includeHidden ? '?include_hidden=true' : ''}`)
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

export function approveCompany(companyId: number): Promise<AdminCompany> {
  return apiRequest<AdminCompany>(`/admin/companies/${companyId}/approve`, {
    method: 'PUT',
  })
}

export function blockCompany(companyId: number): Promise<AdminCompany> {
  return apiRequest<AdminCompany>(`/admin/companies/${companyId}/block`, {
    method: 'PUT',
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

export function getRecruiters(): Promise<StaffMember[]> {
  return apiRequest<StaffMember[]>('/admin/recruiters')
}

export function createRecruiter(payload: RecruiterCreatePayload): Promise<StaffMember> {
  return apiRequest<StaffMember>('/admin/recruiters', {
    method: 'POST',
    body: payload,
  })
}

/** Deactivate (never delete) a company: login blocked and its jobs leave the public and AK lists. */
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
