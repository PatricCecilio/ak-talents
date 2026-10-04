import type { StageValue } from '../types/pipeline'

// Display only. Who may move where is decided by the backend (allowed_next_stages).
// Labels must match backend/app/core/pipeline.py STAGE_LABELS (a test keeps them in sync).
export const AK_STAGE_LABELS: Record<StageValue, string> = {
  new: 'Nova',
  screening: 'Em triagem',
  ak_interview: 'Entrevista com a AK',
  finalist: 'Finalista (enviado ao cliente)',
  client_approved: 'Aprovado pelo cliente',
  hired: 'Contratado',
  rejected: 'Reprovado',
  withdrawn: 'Desistiu',
}

/** Short column titles for the pipeline board. */
export const STAGE_SHORT_LABELS: Record<StageValue, string> = {
  new: 'Novas',
  screening: 'Em triagem',
  ak_interview: 'Entrevista AK',
  finalist: 'Finalistas',
  client_approved: 'Aprovados',
  hired: 'Contratados',
  rejected: 'Reprovados',
  withdrawn: 'Desistiram',
}

export const PIPELINE_COLUMNS: StageValue[] = ['new', 'screening', 'ak_interview', 'finalist', 'client_approved', 'hired']
export const CLOSED_STAGES: StageValue[] = ['rejected', 'withdrawn']

const STAGE_TONES: Record<StageValue, string> = {
  new: 'bg-slate-100 text-ink-700',
  screening: 'bg-sky-50 text-sky-800',
  ak_interview: 'bg-indigo-50 text-indigo-800',
  finalist: 'bg-gold-50 text-gold-800',
  client_approved: 'bg-emerald-50 text-emerald-800',
  hired: 'bg-emerald-600 text-white',
  rejected: 'bg-red-50 text-red-700',
  withdrawn: 'bg-slate-100 text-ink-600',
}

export function stageTone(stage: StageValue): string {
  return STAGE_TONES[stage] ?? STAGE_TONES.new
}

const SCREENING_LABELS: Record<string, string> = {
  QUALIFIED: 'Atende aos requisitos',
  NOT_MATCHED: 'Não atende a algum requisito',
  REVIEW: 'Para análise da equipe',
  PENDING: 'Triagem incompleta',
  pending_screening: 'Triagem não respondida',
}

export function formatScreeningStatus(status: string): string {
  return SCREENING_LABELS[status] ?? status
}

/** "hoje", "ontem" or "há N dias" (calendar days in the viewer's timezone). */
export function formatDaysAgo(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate)
  const startOf = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  return `há ${days} dias`
}

export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** wa.me link for a Brazilian phone, adding the 55 country code when missing. Empty if too short. */
export function whatsappLink(phone: string | null): string {
  const digits = (phone ?? '').replace(/\D+/g, '')
  if (digits.length < 10) return ''
  return `https://wa.me/${digits.startsWith('55') && digits.length > 11 ? digits : `55${digits}`}`
}
