import type { CandidateMatch, Job, JobPayload } from '../types/user'
import { apiRequest } from './api'

export function createJob(payload: JobPayload): Promise<Job> {
  return apiRequest<Job>('/jobs', {
    method: 'POST',
    body: payload,
  })
}

export function getJobs(): Promise<Job[]> {
  return apiRequest<Job[]>('/jobs', {
    method: 'GET',
    auth: false,
  })
}

/** All jobs of the signed-in company, in any status (pending, approved, hidden). */
export function getMyCompanyJobs(): Promise<Job[]> {
  return apiRequest<Job[]>('/companies/me/jobs', {
    method: 'GET',
  })
}

export function getJobBySlug(slug: string): Promise<Job> {
  return apiRequest<Job>(`/jobs/${slug}`, {
    method: 'GET',
    auth: false,
  })
}

export function getJobMatches(jobId: number): Promise<CandidateMatch[]> {
  return apiRequest<CandidateMatch[]>(`/jobs/${jobId}/matches`, {
    method: 'GET',
  })
}
