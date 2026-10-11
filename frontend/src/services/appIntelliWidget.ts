import type { AppIntelliApi, AppIntelliOpenOptions } from '../types/appIntelli'
import { installAppIntelliWidget } from './appIntelliWidgetLoader.ts'

export interface AppIntelliCta {
  intentHint: string
  entryPoint: string
  pageSection: string
  journeyStage: string
  ctaLabel: string
}

// Every landing CTA that opens the AppIntelli chat, in one place. Menu links stay plain navigation.
export const appIntelliCtas = {
  heroDemo: {
    intentHint: 'hiring',
    entryPoint: 'hero_demo',
    pageSection: 'hero',
    journeyStage: 'consideration',
    ctaLabel: 'Conversar com a AK Talent',
  },
  headerContact: {
    intentHint: 'general_contact',
    entryPoint: 'header_contact',
    pageSection: 'header',
    journeyStage: 'consideration',
    ctaLabel: 'Conversar com a AK Talent',
  },
  sectionDemo: {
    intentHint: 'hiring',
    entryPoint: 'solution_section',
    pageSection: 'solution',
    journeyStage: 'consideration',
    ctaLabel: 'Conversar com a AK Talent',
  },
  triageDemo: {
    intentHint: 'hiring',
    entryPoint: 'triage_section',
    pageSection: 'triage',
    journeyStage: 'consideration',
    ctaLabel: 'Conversar com a AK Talent',
  },
  benefitsDemo: {
    intentHint: 'hiring',
    entryPoint: 'benefits_section',
    pageSection: 'benefits',
    journeyStage: 'consideration',
    ctaLabel: 'Conversar com a AK Talent',
  },
  finalDemo: {
    intentHint: 'general_contact',
    entryPoint: 'final_cta',
    pageSection: 'final_cta',
    journeyStage: 'decision',
    ctaLabel: 'Conversar com a AK Talent',
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
  installWidget?: () => HTMLScriptElement | null
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

function shouldInstallWidget(env: OpenEnvironment, host: AppIntelliHost): boolean {
  return !env.host && typeof window !== 'undefined' && host === window
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
    console.error('[AK Talent] AppIntelli.open falhou ao abrir o chat.')
    return 'unavailable'
  }

  if (shouldInstallWidget(env, host)) {
    const script = (env.installWidget ?? installAppIntelliWidget)()
    if (!script) {
      return 'unavailable'
    }
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
      if (!opened) console.error('[AK Talent] AppIntelli widget indisponivel no momento.')
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
