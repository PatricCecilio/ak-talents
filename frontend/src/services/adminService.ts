import type { AdminApplication, AdminCandidate, AdminCompany, AdminJob, AdminUser } from '../types/user'
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

export function getAdminApplications(): Promise<AdminApplication[]> {
  return apiRequest<AdminApplication[]>('/admin/applications')
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
