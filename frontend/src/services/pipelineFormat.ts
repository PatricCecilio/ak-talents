import type { StageValue } from '../types/pipeline'

// Display only. Who may move where is decided by the backend (allowed_next_stages).
// Labels must match backend/app/core/pipeline.py STAGE_LABELS (a test keeps them in sync).
export const AK_STAGE_LABELS: Record<StageValue, string> = {
  new: 'Nova',
  screening: 'Em triagem',
  ak_interview: 'Entrevista AK',
  finalist: 'Enviado ao cliente',
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
  finalist: 'Enviados ao cliente',
  client_approved: 'Aprovados',
  hired: 'Contratados',
  rejected: 'Reprovados',
  withdrawn: 'Desistiram',
}

// The client no longer uses the system: AK records the client's answer when leaving "Enviado ao cliente".
// Mirrors CLIENT_RESPONSES in backend/app/core/pipeline.py (the API requires the observation).
const CLIENT_RESPONSE_LABELS: Partial<Record<StageValue, string>> = {
  client_approved: 'Cliente aprovou',
  rejected: 'Cliente recusou',
}

export function isClientResponse(currentStage: StageValue | undefined, toStage: StageValue | ''): boolean {
  return currentStage === 'finalist' && toStage !== '' && toStage in CLIENT_RESPONSE_LABELS
}

/** Option text in "Mover para": from "Enviado ao cliente", approve/reject read as the client's answer. */
export function moveOptionLabel(currentStage: StageValue | undefined, option: { value: StageValue; label: string }): string {
  return isClientResponse(currentStage, option.value) ? (CLIENT_RESPONSE_LABELS[option.value] ?? option.label) : option.label
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
  NO_QUESTIONS: 'Sem perguntas de triagem',
}

export function formatScreeningStatus(status: string): string {
  return SCREENING_LABELS[status] ?? status
}

function calendarDaysSince(isoDate: string, now: Date): number {
  const date = new Date(isoDate)
  const startOf = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  return Math.round((startOf(now) - startOf(date)) / 86_400_000)
}

/** "hoje", "ontem" or "há N dias" (calendar days in the viewer's timezone). */
export function formatDaysAgo(isoDate: string, now: Date = new Date()): string {
  const days = calendarDaysSince(isoDate, now)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  return `há ${days} dias`
}

/** Finalist card: how long the client company has had the candidate to decide. */
export function finalistWaitingLabel(sinceIso: string, now: Date = new Date()): string {
  const days = calendarDaysSince(sinceIso, now)
  if (days <= 0) return 'Aguardando o cliente desde hoje'
  return days === 1 ? 'Aguardando o cliente há 1 dia' : `Aguardando o cliente há ${days} dias`
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
