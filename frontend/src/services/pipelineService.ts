import type {
  ApplicationDetail,
  ApplicationNote,
  JobPipelineResponse,
  RecruiterJobsResponse,
  StageMovePayload,
  StageMoveResponse,
} from '../types/pipeline'
import { apiRequest } from './api'

export function getRecruiterJobs(): Promise<RecruiterJobsResponse> {
  return apiRequest<RecruiterJobsResponse>('/recruiter/jobs')
}

/** includeHidden: the admin also gets the applications they hid (the API ignores it for recruiters). */
export function getJobPipeline(jobId: number, includeHidden = false): Promise<JobPipelineResponse> {
  return apiRequest<JobPipelineResponse>(`/recruiter/jobs/${jobId}/applications${includeHidden ? '?include_hidden=true' : ''}`)
}

export function getApplicationDetail(applicationId: number): Promise<ApplicationDetail> {
  return apiRequest<ApplicationDetail>(`/recruiter/applications/${applicationId}`)
}

export function moveApplication(applicationId: number, payload: StageMovePayload): Promise<StageMoveResponse> {
  return apiRequest<StageMoveResponse>(`/recruiter/applications/${applicationId}/stage`, {
    method: 'POST',
    body: payload,
  })
}

export function addApplicationNote(applicationId: number, body: string, kind = 'anotacao'): Promise<ApplicationNote> {
  return apiRequest<ApplicationNote>(`/recruiter/applications/${applicationId}/notes`, {
    method: 'POST',
    body: { body, kind },
  })
}
