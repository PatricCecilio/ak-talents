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
