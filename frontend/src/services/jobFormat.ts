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
