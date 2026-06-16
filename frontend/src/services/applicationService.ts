import type { Application, ApplicationPayload } from '../types/user'
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
