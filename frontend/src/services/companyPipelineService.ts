import type { CompanyFinalist, CompanyFinalistsResponse, FinalistDecisionValue } from '../types/companyPipeline'
import { apiRequest } from './api'

export function getCompanyFinalists(): Promise<CompanyFinalistsResponse> {
  return apiRequest<CompanyFinalistsResponse>('/companies/me/finalists')
}

export function decideFinalist(applicationId: number, decision: FinalistDecisionValue, reason?: string): Promise<CompanyFinalist> {
  return apiRequest<CompanyFinalist>(`/companies/me/finalists/${applicationId}/decision`, {
    method: 'POST',
    body: { decision, reason: reason?.trim() || undefined },
  })
}
