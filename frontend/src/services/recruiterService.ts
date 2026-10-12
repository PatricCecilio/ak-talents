import type { StaffMember } from '../types/user'
import { apiRequest } from './api'

/** Active admins and recruiters, for the "responsible recruiter" select. */
export function getTeam(): Promise<StaffMember[]> {
  return apiRequest<StaffMember[]>('/recruiter/team')
}

