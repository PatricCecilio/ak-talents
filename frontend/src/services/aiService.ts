import type {
  AIStatus,
  CandidateProfileAIRequest,
  CandidateProfileAIResponse,
  CompanyJobAIRequest,
  CompanyJobAIResponse,
} from '../types/ai'
import { apiRequest } from './api'

export function getAiStatus(): Promise<AIStatus> {
  return apiRequest<AIStatus>('/ai/status', { auth: false })
}

export function generateCandidateProfile(
  payload: CandidateProfileAIRequest,
): Promise<CandidateProfileAIResponse> {
  return apiRequest<CandidateProfileAIResponse>('/ai/candidate-profile', {
    method: 'POST',
    body: payload,
  })
}

export function generateCompanyJob(payload: CompanyJobAIRequest): Promise<CompanyJobAIResponse> {
  return apiRequest<CompanyJobAIResponse>('/ai/company-job', {
    method: 'POST',
    body: payload,
  })
}
