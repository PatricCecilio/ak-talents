import type { AppIntelliApi, AppIntelliOpenOptions } from '../types/appIntelli'

export interface AppIntelliCta {
  intentHint: string
  entryPoint: string
  pageSection: string
  journeyStage: string
  ctaLabel: string
}

// Every landing CTA that opens the AppIntelli chat, in one place. Menu links stay plain navigation.
export const appIntelliCtas = {
  heroHiring: {
    intentHint: 'hiring',
    entryPoint: 'hero_company',
    pageSection: 'hero',
    journeyStage: 'consideration',
    ctaLabel: 'Quero contratar',
  },
  heroJobSeeker: {
    intentHint: 'job_seeker',
    entryPoint: 'hero_professional',
    pageSection: 'hero',
    journeyStage: 'consideration',
    ctaLabel: 'Busco oportunidades',
  },
  headerContact: {
    intentHint: 'general_contact',
    entryPoint: 'header_contact',
    pageSection: 'header',
    journeyStage: 'consideration',
    ctaLabel: 'Falar com a AK Talent',
  },
  companySection: {
    intentHint: 'hiring',
    entryPoint: 'company_section',
    pageSection: 'companies',
    journeyStage: 'consideration',
    ctaLabel: 'Quero contratar',
  },
  professionalSection: {
    intentHint: 'job_seeker',
    entryPoint: 'professional_section',
    pageSection: 'professionals',
    journeyStage: 'consideration',
    ctaLabel: 'Apresentar meu perfil',
  },
  finalContact: {
    intentHint: 'general_contact',
    entryPoint: 'final_cta',
    pageSection: 'final_cta',
    journeyStage: 'decision',
    ctaLabel: 'Falar com a AK Talent',
  },
} as const satisfies Record<string, AppIntelliCta>

export type AppIntelliCtaId = keyof typeof appIntelliCtas

export function toRecruitmentScreeningOpenOptions(applicationReference: string): AppIntelliOpenOptions {
  return {
    context: {
      intentHint: 'recruitment_screening',
      entryPoint: 'public_application_success',
      pageSection: 'job_detail',
      journeyStage: 'screening',
      metadata: {
        ctaLabel: 'Continuar triagem',
        applicationReference,
      },
    },
  }
}

export function toOpenOptions(cta: AppIntelliCta): AppIntelliOpenOptions {
  return {
    context: {
      intentHint: cta.intentHint,
      entryPoint: cta.entryPoint,
      pageSection: cta.pageSection,
      journeyStage: cta.journeyStage,
      metadata: { ctaLabel: cta.ctaLabel },
    },
  }
}

type AppIntelliHost = { AppIntelli?: AppIntelliApi }

interface OpenEnvironment {
  host?: AppIntelliHost
  // widget.js loads async: a very early click waits briefly for window.AppIntelli (no event exists).
  waitMs?: number
  pollMs?: number
}

export type OpenResult = 'opened' | 'waiting' | 'unavailable'

let pendingWait: ReturnType<typeof setInterval> | null = null

function tryOpen(host: AppIntelliHost, options: AppIntelliOpenOptions): boolean {
  const api = host.AppIntelli
  if (!api || typeof api.open !== 'function') return false
  api.open(options)
  return true
}

export function openAppIntelliOptions(options: AppIntelliOpenOptions, env: OpenEnvironment = {}): OpenResult {
  const host = env.host ?? window

  if (pendingWait) {
    clearInterval(pendingWait)
    pendingWait = null
  }

  try {
    if (tryOpen(host, options)) return 'opened'
  } catch {
    return 'unavailable'
  }

  const waitMs = env.waitMs ?? 8000
  const pollMs = env.pollMs ?? 150
  const startedAt = Date.now()
  pendingWait = setInterval(() => {
    let opened = false
    try {
      opened = tryOpen(host, options)
    } catch {
      // A throwing loader counts as "not opened yet"; keep waiting until the deadline.
    }
    if (opened || Date.now() - startedAt >= waitMs) {
      if (pendingWait) clearInterval(pendingWait)
      pendingWait = null
      if (!opened) console.warn('[AK Talent] AppIntelli widget indisponivel no momento.')
    }
  }, pollMs)
  return 'waiting'
}

/**
 * Opens the AppIntelli chat with the CTA's entry context. Only calls the public widget API: it
 * never posts a message, never touches the widget iframe and never creates a conversation.
 */
export function openAppIntelli(cta: AppIntelliCta, env: OpenEnvironment = {}): OpenResult {
  return openAppIntelliOptions(toOpenOptions(cta), env)
}
