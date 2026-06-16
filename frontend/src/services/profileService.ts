import type {
  CandidateProfile,
  CandidateProfilePayload,
  CompanyProfile,
  CompanyProfilePayload,
} from '../types/user'
import { apiRequest } from './api'

export function getCandidateProfile(): Promise<CandidateProfile> {
  return apiRequest<CandidateProfile>('/candidates/me')
}

export function updateCandidateProfile(payload: CandidateProfilePayload): Promise<CandidateProfile> {
  return apiRequest<CandidateProfile>('/candidates/me', {
    method: 'PUT',
    body: payload,
  })
}

export function getCompanyProfile(): Promise<CompanyProfile> {
  return apiRequest<CompanyProfile>('/companies/me')
}

export function updateCompanyProfile(payload: CompanyProfilePayload): Promise<CompanyProfile> {
  return apiRequest<CompanyProfile>('/companies/me', {
    method: 'PUT',
    body: payload,
  })
}
