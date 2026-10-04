import type { CandidateApplicationsResponse } from '../types/candidatePipeline'
import { apiRequest } from './api'

/** The signed-in candidate's applications, with a friendly status only. */
export function getMyApplications(): Promise<CandidateApplicationsResponse> {
  return apiRequest<CandidateApplicationsResponse>('/candidates/me/applications')
}
