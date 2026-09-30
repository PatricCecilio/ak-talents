import type {
  Application,
  ApplicationPayload,
  PublicApplicationPayload,
  PublicApplicationResponse,
  PublicScreeningResponse,
  ScreeningSubmitPayload,
  ScreeningSubmitResponse,
} from '../types/user'
import { apiRequest } from './api'

export function createApplication(payload: ApplicationPayload): Promise<Application> {
  return apiRequest<Application>('/applications', {
    method: 'POST',
    body: payload,
  })
}

export function getApplications(): Promise<Application[]> {
  return apiRequest<Application[]>('/applications')
}

export function createPublicApplication(
  slug: string,
  payload: PublicApplicationPayload,
): Promise<PublicApplicationResponse> {
  return apiRequest<PublicApplicationResponse>(`/jobs/${slug}/applications`, {
    method: 'POST',
    body: payload,
    auth: false,
  })
}

export function submitScreeningAnswers(
  token: string,
  payload: ScreeningSubmitPayload,
): Promise<ScreeningSubmitResponse> {
  return apiRequest<ScreeningSubmitResponse>(`/public/applications/${token}/screening`, {
    method: 'POST',
    body: payload,
    auth: false,
  })
}

export function getPublicScreening(token: string): Promise<PublicScreeningResponse> {
  return apiRequest<PublicScreeningResponse>(`/public/applications/${token}/screening`, {
    method: 'GET',
    auth: false,
  })
}
