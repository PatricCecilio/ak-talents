// "Continuar com o Google" (Google Identity Services, ID token flow). The script is loaded only on the pages that show
// the button (never site-wide). Without VITE_GOOGLE_CLIENT_ID the button is not shown at all.

export const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
export const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services'

export function googleClientId(env: ImportMetaEnv = import.meta.env): string {
  return env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''
}

export function isGoogleLoginEnabled(env: ImportMetaEnv = import.meta.env): boolean {
  return googleClientId(env).length > 0
}

/**
 * Phones and tablets open Google's popup as a separate tab that never hands the result back to the site (blank page
 * at accounts.google.com on Android Chrome and Edge). Until the redirect flow ships, the button is not shown there.
 */
export function isPopupUnreliable(userAgent: string, maxTouchPoints = 0): boolean {
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(userAgent)) return true
  // iPadOS reports itself as a Mac; touch support gives it away.
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1
}

/** The Google button is offered only when configured and on browsers where the popup works. */
export function isGoogleButtonAvailable(env: ImportMetaEnv = import.meta.env): boolean {
  if (!isGoogleLoginEnabled(env)) return false
  if (typeof navigator === 'undefined') return true
  return !isPopupUnreliable(navigator.userAgent, navigator.maxTouchPoints)
}

interface GoogleCredentialResponse {
  credential?: string
}

interface GoogleAccountsId {
  initialize: (options: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    ux_mode?: 'popup' | 'redirect'
    context?: 'signin' | 'signup' | 'use'
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

let loading: Promise<GoogleAccountsId> | null = null

/** Loads Google's script once and resolves with google.accounts.id. */
export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  const ready = window.google?.accounts?.id
  if (ready) return Promise.resolve(ready)
  if (loading) return loading

  loading = new Promise<GoogleAccountsId>((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID) as HTMLScriptElement | null
    const script = existing ?? document.createElement('script')
    const done = () => {
      const api = window.google?.accounts?.id
      if (api) resolve(api)
      else reject(new Error('Google Identity Services indisponível.'))
    }
    script.addEventListener('load', done, { once: true })
    script.addEventListener('error', () => reject(new Error('Não foi possível carregar o login com Google.')), { once: true })
    if (!existing) {
      script.id = GOOGLE_IDENTITY_SCRIPT_ID
      script.src = GOOGLE_IDENTITY_SCRIPT_URL
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }).catch((error) => {
    loading = null // allow a retry on the next page
    throw error
  })
  return loading
}

export const GOOGLE_LINKED_NOTICE = 'Sua conta agora entra com o Google. A senha antiga deixou de funcionar.'
