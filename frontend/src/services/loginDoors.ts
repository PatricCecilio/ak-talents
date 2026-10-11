// Login "doors" per audience. The API has a single login; the door only changes the texts and what happens when
// someone signs in through the wrong one. No runtime imports: the tests load this file directly.

export type LoginDoor = 'candidato' | 'empresa' | 'equipe'
type Role = 'candidate' | 'company' | 'admin' | 'recruiter'

export const LOGIN_CHOOSER_PATH = '/entrar'
export const STAFF_LOGIN_PATH = '/equipe'

export const DOOR_PATHS: Record<LoginDoor, string> = {
  candidato: '/entrar/candidato',
  empresa: '/entrar/empresa',
  equipe: STAFF_LOGIN_PATH,
}

export interface DoorCopy {
  title: string
  subtitle: string
  /** Sign-up link; the staff door has none (accounts are created by the admin). */
  signUp: { prompt: string; label: string; to: string } | null
}

export const DOOR_COPY: Record<LoginDoor, DoorCopy> = {
  candidato: {
    title: 'Entrar como candidato',
    subtitle: 'Acompanhe suas candidaturas e veja em que etapa está cada processo seletivo.',
    signUp: { prompt: 'Ainda não tem conta?', label: 'Criar conta de candidato', to: '/register?tipo=candidato' },
  },
  empresa: {
    title: 'Entrar como empresa',
    subtitle: 'Publique vagas, acompanhe os processos e aprove os finalistas que a AK Talent selecionou.',
    signUp: { prompt: 'Sua empresa ainda não tem conta?', label: 'Cadastrar minha empresa', to: '/register?tipo=empresa' },
  },
  equipe: {
    title: 'Equipe AK Talent',
    subtitle: 'Acesso da equipe de recrutamento e da administração.',
    signUp: null,
  },
}

const ROLE_HOME: Record<Role, string> = {
  admin: '/admin',
  recruiter: '/recrutador',
  company: '/company',
  candidate: '/candidate',
}

const ROLE_DOOR: Record<Role, LoginDoor> = {
  candidate: 'candidato',
  company: 'empresa',
  admin: 'equipe',
  recruiter: 'equipe',
}

const ROLE_PANEL_NAME: Record<Role, string> = {
  candidate: 'o painel do candidato',
  company: 'o painel da empresa',
  admin: 'o painel da equipe AK Talent',
  recruiter: 'o painel da equipe AK Talent',
}

const ACCOUNT_KIND: Record<Role, string> = {
  candidate: 'de candidato',
  company: 'de empresa',
  admin: 'da equipe AK Talent',
  recruiter: 'da equipe AK Talent',
}

const DOOR_AREA: Record<LoginDoor, string> = {
  candidato: 'pela área de candidatos',
  empresa: 'pela área de empresas',
  equipe: 'pela área da equipe',
}

export const STAFF_ONLY_MESSAGE = 'Esta área é só para a equipe AK Talent.'

export type LoginDecision =
  | { action: 'enter'; to: string; notice?: string }
  | { action: 'refuse'; message: string; link: { label: string; to: string } }

/** The door a role belongs to (used for "Já tem conta? Entrar", sign-out and private routes). */
export function doorForRole(role: string | null | undefined): LoginDoor {
  return ROLE_DOOR[role as Role] ?? 'candidato'
}

export function doorPathForRole(role: string | null | undefined): string {
  return DOOR_PATHS[doorForRole(role)]
}

/**
 * What happens after a successful login. Never blocks someone who used the wrong public door (they go to their own
 * panel with a short notice). The only refusal: a candidate or company account at the staff door.
 */
export function decideAfterLogin(door: LoginDoor, role: string): LoginDecision {
  const knownRole = role as Role
  const home = ROLE_HOME[knownRole] ?? '/candidate'
  const ownDoor = ROLE_DOOR[knownRole] ?? 'candidato'

  if (door === 'equipe' && ownDoor !== 'equipe') {
    const label = ownDoor === 'empresa' ? 'Entrar como empresa' : 'Entrar como candidato'
    return { action: 'refuse', message: STAFF_ONLY_MESSAGE, link: { label, to: DOOR_PATHS[ownDoor] } }
  }
  if (door === ownDoor) return { action: 'enter', to: home }
  return {
    action: 'enter',
    to: home,
    notice: `Você entrou ${DOOR_AREA[door]}, mas sua conta é ${ACCOUNT_KIND[knownRole] ?? 'de candidato'}. Abrimos ${ROLE_PANEL_NAME[knownRole] ?? 'o seu painel'}.`,
  }
}
