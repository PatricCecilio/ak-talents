import { useEffect, useRef, useState } from 'react'
import { Alert } from '../ui'
import { googleClientId, googleReturnUri, isGoogleLoginEnabled, loadGoogleIdentity } from '../../services/googleIdentity'

interface GoogleSignInButtonProps {
  /** Decides the account type only when a new account is created. Never rendered for the staff door. */
  door: 'candidato' | 'empresa'
  /** Where the "ou" divider goes: below (login pages, button first) or above (sign-up, button after the form). */
  divider?: 'below' | 'above'
}

// "Continuar com o Google" in REDIRECT mode (all browsers): the page goes to Google and comes back through
// /auth/google/retorno/<door> -> API -> /entrar/google (GoogleReturnPage). No popup: it hangs on phones.
export function GoogleSignInButton({ door, divider = 'below' }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isGoogleLoginEnabled()) return
    let active = true
    loadGoogleIdentity()
      .then((google) => {
        const container = buttonRef.current
        if (!active || !container) return
        // Re-initialized when the door changes (sign-up: Candidato <-> Empresa) so Google returns to the right one.
        google.initialize({
          client_id: googleClientId(),
          ux_mode: 'redirect',
          login_uri: googleReturnUri(door),
          context: 'signin',
        })
        container.innerHTML = ''
        google.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          locale: 'pt-BR',
          width: Math.min(400, Math.max(200, Math.round(container.getBoundingClientRect().width))),
        })
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar o login com Google. Use e-mail e senha.')
      })
    return () => {
      active = false
    }
  }, [door])

  if (!isGoogleLoginEnabled()) return null

  const orDivider = (
    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-400" aria-hidden="true">
      <span className="h-px flex-1 bg-slate-200" />
      ou
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  )

  return (
    <div className="grid gap-4" data-google-sign-in>
      {divider === 'above' ? orDivider : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {/* Google draws its button inside this element, outside React's control. */}
      <div ref={buttonRef} className="flex min-h-11 max-w-full justify-center overflow-hidden" />
      {divider === 'below' ? orDivider : null}
    </div>
  )
}
