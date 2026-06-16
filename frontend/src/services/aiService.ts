import type {
  CandidateProfileAIRequest,
  CandidateProfileAIResponse,
  CompanyJobAIRequest,
  CompanyJobAIResponse,
} from '../types/ai'
import { apiRequest } from './api'

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
