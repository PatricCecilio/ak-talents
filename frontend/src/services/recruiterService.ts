import type { AdminJob, StaffMember } from '../types/user'
import { apiRequest } from './api'

/** Active admins and recruiters, for the "responsible recruiter" select. */
export function getTeam(): Promise<StaffMember[]> {
  return apiRequest<StaffMember[]>('/recruiter/team')
}

export function setJobResponsible(jobId: number, recruiterId: number | null): Promise<AdminJob> {
  return apiRequest<AdminJob>(`/recruiter/jobs/${jobId}/responsible`, {
    method: 'PUT',
    body: { recruiter_id: recruiterId },
  })
}
