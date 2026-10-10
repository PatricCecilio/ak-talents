import type { Job } from '../types/user'

const WORK_MODE_LABELS: Record<string, string> = {
  remote: 'Remoto',
  hybrid: 'Híbrido',
  onsite: 'Presencial',
}

/** Human label for the API work mode (remote/hybrid/onsite); unknown values pass through. */
export function formatWorkMode(workMode: string | null | undefined): string {
  if (!workMode) return ''
  return WORK_MODE_LABELS[workMode.toLowerCase()] ?? workMode
}

const JOB_STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando aprovação',
  approved: 'Publicada',
  hidden: 'Oculta',
  closed: 'Encerrada',
}

const COMPANY_STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando aprovação',
  approved: 'Aprovada',
  blocked: 'Bloqueada',
}

/** Portuguese label for a company account status (admin panel). */
export function formatCompanyStatus(status: string | null | undefined): string {
  if (!status) return ''
  return COMPANY_STATUS_LABELS[status] ?? status
}

/** Portuguese label for a job moderation status shown to the company. */
export function formatJobStatus(status: string | null | undefined): string {
  if (!status) return ''
  return JOB_STATUS_LABELS[status] ?? status
}

export function formatSalary(job: Pick<Job, 'salary_min' | 'salary_max'>): string {
  if (job.salary_min && job.salary_max) {
    return `R$ ${job.salary_min.toLocaleString('pt-BR')} - R$ ${job.salary_max.toLocaleString('pt-BR')}`
  }

  if (job.salary_min) {
    return `A partir de R$ ${job.salary_min.toLocaleString('pt-BR')}`
  }

  if (job.salary_max) {
    return `Até R$ ${job.salary_max.toLocaleString('pt-BR')}`
  }

  return ''
}
