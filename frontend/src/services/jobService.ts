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

export function getJobMatches(jobId: number): Promise<CandidateMatch[]> {
  return apiRequest<CandidateMatch[]>(`/jobs/${jobId}/matches`, {
    method: 'GET',
  })
}
