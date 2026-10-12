// Pure helpers of the new panel (/painel): menu per role, labels, tones and relative dates.
// No runtime imports: the tests load this file directly.

import type { JobsListFilters } from './types'

export const PANEL_BASE = '/painel'

/** Query string with only the filters that are set. */
export function queryString(filters: object): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '' || value === false) continue
    params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function jobsQuery(filters: JobsListFilters): string {
  return queryString(filters)
}

/** "(41) 9••••-1203": the list shows only the end of the number; the profile shows it whole. */
export function maskPhone(phone: string | null | undefined): string {
  let digits = (phone ?? '').replace(/\D+/g, '')
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2)
  if (digits.length < 8) return phone ? '••••' : '—'
  const ddd = digits.length >= 10 ? `(${digits.slice(0, 2)}) ` : ''
  const local = digits.length >= 10 ? digits.slice(2) : digits
  return `${ddd}${local[0]}••••-${local.slice(-4)}`
}

/** Tone of the stage pill in the candidates list. */
export const STAGE_TONES: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700',
  screening: 'bg-violet-50 text-violet-700',
  ak_interview: 'bg-gold-50 text-gold-800',
  finalist: 'bg-amber-50 text-amber-800',
  client_approved: 'bg-emerald-50 text-emerald-800',
  hired: 'bg-emerald-100 text-emerald-900',
  rejected: 'bg-red-50 text-red-700',
  withdrawn: 'bg-slate-100 text-ink-600',
}

export const CANDIDATE_STAGE_FILTERS = [
  { value: '', label: 'Todas as etapas' },
  { value: 'new', label: 'Nova' },
  { value: 'screening', label: 'Em triagem' },
  { value: 'ak_interview', label: 'Entrevista AK' },
  { value: 'finalist', label: 'Enviado ao cliente' },
  { value: 'client_approved', label: 'Aprovado pelo cliente' },
  { value: 'hired', label: 'Contratado' },
  { value: 'rejected', label: 'Reprovado' },
  { value: 'withdrawn', label: 'Desistiu' },
  { value: 'none', label: 'Sem candidatura' },
] as const

/** Strong confirmation of the LGPD erasure: the name typed again (spaces and case do not matter). */
export function erasureConfirmed(typed: string, name: string): boolean {
  return typed.trim().length > 0 && typed.trim().toLowerCase() === name.trim().toLowerCase()
}

export interface PanelMenuItem {
  to: string
  label: string
  icon: 'home' | 'building' | 'briefcase' | 'users' | 'person'
  /** Shows the "to triage" count next to the label. */
  badge?: 'to_triage'
  /** Screens of a later stage: shown, not clickable yet. */
  soon?: boolean
}

/** Sidebar. "Recrutadoras" (Administração) is admin only; there is no general "Candidaturas" screen. */
export function panelMenu(role: string): { main: PanelMenuItem[]; admin: PanelMenuItem[] } {
  const main: PanelMenuItem[] = [
    { to: PANEL_BASE, label: 'Visão geral', icon: 'home' },
    { to: `${PANEL_BASE}/empresas`, label: 'Empresas', icon: 'building' },
    { to: `${PANEL_BASE}/vagas`, label: 'Vagas', icon: 'briefcase', badge: 'to_triage' },
    { to: `${PANEL_BASE}/candidatos`, label: 'Candidatos', icon: 'users' },
  ]
  const admin: PanelMenuItem[] = role === 'admin' ? [{ to: `${PANEL_BASE}/recrutadoras`, label: 'Recrutadoras', icon: 'person' }] : []
  return { main, admin }
}

export const ROLE_LABELS: Record<string, string> = { admin: 'Administradora', recruiter: 'Recrutadora' }

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'AK'
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "Bom dia" / "Boa tarde" / "Boa noite" by the local hour. */
export function greeting(now: Date = new Date()): string {
  const hour = now.getHours()
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
}

/** "segunda, 12 de outubro" */
export function longDate(now: Date = new Date()): string {
  return `${WEEKDAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS[now.getMonth()]}`
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Calendar days between the date and today (0 = today). */
export function daysAgo(iso: string, now: Date = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000)
}

/** Activity times: "agora", "há 15 min", "há 2 h", "ontem", "há 3 dias", "05/10". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const days = daysAgo(iso, now)
  if (days <= 0) return `há ${Math.floor(minutes / 60)} h`
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  const date = new Date(iso)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Board cards: "hoje", "ontem", "3 dias". */
export function shortAge(iso: string, now: Date = new Date()): string {
  const days = daysAgo(iso, now)
  return days <= 0 ? 'hoje' : days === 1 ? 'ontem' : `${days} dias`
}

/** "6 dias", "1 dia", "hoje" (since publication). */
export function publishedFor(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '—'
  const days = daysAgo(iso, now)
  return days <= 0 ? 'hoje' : days === 1 ? '1 dia' : `${days} dias`
}

export const JOB_STATUS: Record<string, { label: string; tone: string }> = {
  approved: { label: 'Publicada', tone: 'bg-emerald-50 text-emerald-800' },
  draft: { label: 'Rascunho', tone: 'bg-slate-100 text-ink-700' },
  closed: { label: 'Encerrada', tone: 'bg-gold-50 text-gold-800' },
  archived: { label: 'Arquivada', tone: 'bg-slate-100 text-ink-600' },
}

export function jobStatus(status: string): { label: string; tone: string } {
  return JOB_STATUS[status] ?? { label: status, tone: 'bg-slate-100 text-ink-700' }
}

/** Status filter of the jobs list ("ativas" = everything but archived). */
export const JOB_STATUS_FILTERS = [
  { value: '', label: 'Status: ativas' },
  { value: 'approved', label: 'Publicadas' },
  { value: 'draft', label: 'Rascunhos' },
  { value: 'closed', label: 'Encerradas' },
  { value: 'archived', label: 'Arquivadas' },
] as const

export const ACTIVITY_DOT: Record<string, string> = {
  new_application: 'bg-blue-600',
  sent_to_client: 'bg-gold-500',
  client_approved: 'bg-emerald-600',
  client_rejected: 'bg-red-500',
  hired: 'bg-emerald-700',
  job_published: 'bg-violet-600',
}

/** Board columns (exits rejected/withdrawn stay hidden unless asked). */
export const BOARD_COLUMNS = ['new', 'screening', 'ak_interview', 'finalist', 'client_approved', 'hired'] as const
export const EXIT_STAGES = ['rejected', 'withdrawn'] as const

export const COLUMN_TITLES: Record<string, string> = {
  new: 'Nova',
  screening: 'Triagem',
  ak_interview: 'Entrevista AK',
  finalist: 'Enviado ao cliente',
  client_approved: 'Cliente aprovou',
  hired: 'Contratado',
  rejected: 'Reprovado',
  withdrawn: 'Desistiu',
}

/** "Curitiba · 2 anos" (experience only when known). */
export function cardSubtitle(city: string | null, experienceYears: number | null | undefined): string {
  const experience =
    experienceYears === null || experienceYears === undefined
      ? ''
      : experienceYears === 0
        ? '1º emprego'
        : `${Number.isInteger(experienceYears) ? experienceYears : experienceYears.toFixed(1).replace('.', ',')} ${experienceYears === 1 ? 'ano' : 'anos'}`
  return [city, experience].filter(Boolean).join(' · ') || 'Cidade não informada'
}

/** Public link of a job (what "Copiar link da vaga" copies). */
export function publicJobUrl(slug: string, origin = 'https://www.aktalent.com.br'): string {
  return `${origin}/vagas/${slug}`
}
