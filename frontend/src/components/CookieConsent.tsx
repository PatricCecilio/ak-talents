import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  CONSENT_CHANGE_EVENT,
  OPEN_PREFERENCES_EVENT,
  gaMeasurementId,
  isTrackedPath,
  loadAnalytics,
  readConsent,
  revokeAnalytics,
  saveConsent,
  setAnalyticsEnabled,
  trackPageView,
  type ConsentChoice,
} from '../services/analytics'
import { PRIVACY_POLICY_PATH } from '../services/privacyPolicy'

// Google Analytics consent (LGPD) + page views on route changes (SPA). Renders nothing without VITE_GA_MEASUREMENT_ID.
// The banner shows on public pages until the visitor chooses; "Preferências de cookies" in the footer reopens it.
export function CookieConsent() {
  const id = gaMeasurementId()
  const { pathname } = useLocation()
  const [choice, setChoice] = useState<ConsentChoice | null>(() => (id ? readConsent() : null))
  const [reopened, setReopened] = useState(false)
  const tracked = isTrackedPath(pathname)

  useEffect(() => {
    const onOpen = () => setReopened(true)
    const onChange = (event: Event) => setChoice((event as CustomEvent<ConsentChoice>).detail)
    window.addEventListener(OPEN_PREFERENCES_EVENT, onOpen)
    window.addEventListener(CONSENT_CHANGE_EVENT, onChange)
    return () => {
      window.removeEventListener(OPEN_PREFERENCES_EVENT, onOpen)
      window.removeEventListener(CONSENT_CHANGE_EVENT, onChange)
    }
  }, [])

  useEffect(() => {
    if (!id || choice !== 'accepted') return
    // Off before loading on a private route; on (and counted) only on public pages.
    setAnalyticsEnabled(id, tracked)
    loadAnalytics(id)
    if (tracked) trackPageView(id, pathname)
  }, [id, choice, pathname, tracked])

  if (!id) return null
  const showBanner = reopened || (choice === null && tracked)
  if (!showBanner) return null

  function choose(next: ConsentChoice) {
    if (next === 'declined') revokeAnalytics(id)
    saveConsent(next)
    setReopened(false)
  }

  return (
    <section
      role="dialog"
      aria-live="polite"
      aria-label="Preferências de cookies"
      className="fixed inset-x-3 bottom-3 z-50 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl shadow-ink-950/15 sm:inset-x-auto sm:left-4 sm:max-w-md sm:p-5"
    >
      <p className="text-sm leading-6 text-ink-700">
        Usamos o Google Analytics para contar as visitas e melhorar o site. Só ativamos se você aceitar.{' '}
        <Link to={PRIVACY_POLICY_PATH} className="font-semibold text-gold-800 underline underline-offset-2 hover:text-ink-950">
          Saiba mais
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => choose('declined')}
          className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-ink-950 transition hover:border-ink-800/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-600"
        >
          Recusar
        </button>
        <button
          type="button"
          onClick={() => choose('accepted')}
          className="min-h-11 flex-1 rounded-lg bg-ink-950 px-4 text-sm font-semibold text-white transition hover:bg-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600"
        >
          Aceitar
        </button>
      </div>
    </section>
  )
}
