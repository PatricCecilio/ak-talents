// Google Analytics 4 with LGPD consent. Nothing loads without VITE_GA_MEASUREMENT_ID and an explicit "Aceitar".
// Only public pages are measured (allowlist), never with query string or hash, and GA is switched off
// (ga-disable-<ID>) on every other route, so no automatic event leaves the private or login areas.
// The pure helpers at the top have no runtime imports: the tests load this file directly.

export const CONSENT_STORAGE_KEY = 'ak_cookie_consent'
export const CONSENT_CHANGE_EVENT = 'ak-cookie-consent-change'
export const OPEN_PREFERENCES_EVENT = 'ak-cookie-preferences-open'
export type ConsentChoice = 'accepted' | 'declined'

export function gaMeasurementId(env: ImportMetaEnv = import.meta.env): string {
  const id = env.VITE_GA_MEASUREMENT_ID?.trim() ?? ''
  return /^G-[A-Z0-9]{4,20}$/.test(id) ? id : ''
}

// Public pages only: home, campaign page, job list, job page and privacy policy.
const TRACKED_PATHS: RegExp[] = [/^\/$/, /^\/solucoes\/recrutamento$/, /^\/vagas$/, /^\/vagas\/[a-z0-9-]+$/, /^\/privacidade$/]

/** Path without query string, hash or trailing slash ("/vagas/" -> "/vagas"). */
export function sanitizePagePath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] || '/'
  return path.length > 1 ? path.replace(/\/+$/, '') || '/' : '/'
}

export function isTrackedPath(pathname: string): boolean {
  const path = sanitizePagePath(pathname)
  return TRACKED_PATHS.some((pattern) => pattern.test(path))
}

/** What GA receives for a page: origin + clean path only (never ?codigo=, e-mail or anything after the path). */
export function pageViewParams(origin: string, pathname: string, title: string) {
  const path = sanitizePagePath(pathname)
  return { page_location: `${origin}${path}`, page_path: path, page_title: title }
}

// --- Stored choice (per browser; reading or writing may fail in private mode) -------------------------------------

export function readConsent(): ConsentChoice | null {
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    return value === 'accepted' || value === 'declined' ? value : null
  } catch {
    return null
  }
}

export function saveConsent(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice)
  } catch {
    // Choice still applies to this visit.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: choice }))
}

export function openCookiePreferences(): void {
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT))
}

// --- gtag ---------------------------------------------------------------------------------------------------------

type GtagWindow = { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; [flag: string]: unknown }

const gtagWindow = () => window as unknown as GtagWindow

let loadedId = ''
// Last page counted: the same page is never counted twice in a row (React may run the effect twice on mount).
let lastTrackedPath = ''

// gtag.js expects the arguments object itself in dataLayer (not an array).
const gtag: (...args: unknown[]) => void = function () {
  const w = gtagWindow()
  w.dataLayer = w.dataLayer || []
  // eslint-disable-next-line prefer-rest-params
  w.dataLayer.push(arguments)
}

/** Injects gtag.js once, after consent. No automatic page_view, no Google signals or ad personalization. */
export function loadAnalytics(id: string): void {
  if (!id || loadedId === id) return
  loadedId = id
  gtagWindow().gtag = gtag
  gtag('js', new Date())
  gtag('config', id, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: `${window.location.origin}${sanitizePagePath(window.location.pathname)}`,
  })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  document.head.appendChild(script)
}

/** On/off per route: GA stays loaded in a SPA, so it is disabled outright outside the public pages. */
export function setAnalyticsEnabled(id: string, enabled: boolean): void {
  if (!id) return
  // Leaving the public pages: coming back to the same page counts again.
  if (!enabled) lastTrackedPath = ''
  gtagWindow()[`ga-disable-${id}`] = !enabled
}

export function trackPageView(id: string, pathname: string): void {
  if (!id || loadedId !== id || !isTrackedPath(pathname)) return
  const params = pageViewParams(window.location.origin, pathname, document.title)
  if (params.page_path === lastTrackedPath) return
  lastTrackedPath = params.page_path
  // Later automatic events of this page also use the clean URL.
  gtag('set', { page_location: params.page_location })
  gtag('event', 'page_view', params)
}

/** "Recusar" after accepting: stop sending and remove GA cookies from this browser. */
export function revokeAnalytics(id: string): void {
  setAnalyticsEnabled(id, false)
  const names = document.cookie
    .split(';')
    .map((cookie) => cookie.split('=')[0].trim())
    .filter((name) => name === '_ga' || name.startsWith('_ga_'))
  const host = window.location.hostname
  const domains = ['', host, `.${host}`, `.${host.replace(/^www\./, '')}`]
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`
    }
  }
}
