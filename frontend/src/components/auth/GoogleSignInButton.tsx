import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button } from '../ui'
import { ApiError } from '../../services/api'
import { authenticateWithGoogle, startSession } from '../../services/authService'
import { GOOGLE_LINKED_NOTICE, googleClientId, isGoogleButtonAvailable, loadGoogleIdentity } from '../../services/googleIdentity'
import { decideAfterLogin } from '../../services/loginDoors'
import { PRIVACY_POLICY_PATH } from '../../services/privacyPolicy'

interface GoogleSignInButtonProps {
  /** Decides the account type only when a new account is created. Never rendered for the staff door. */
  door: 'candidato' | 'empresa'
  /**
   * Sign-up page: its own privacy checkbox counts as consent. Login pages leave it undefined and, for a new account,
   * ask for the consent right here.
   */
  externalConsent?: boolean
  /** Where the "ou" divider goes: below (login pages, button first) or above (sign-up, button after the form). */
  divider?: 'below' | 'above'
}

const linkClass = 'font-bold text-brand-700 underline underline-offset-2 hover:text-brand-600'

// "Continuar com o Google" + an "ou" divider above the e-mail form.
export function GoogleSignInButton({ door, externalConsent, divider = 'below' }: GoogleSignInButtonProps) {
  const navigate = useNavigate()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [isSending, setIsSending] = useState(false)
  // New account from a login page: keep the Google credential and ask for the privacy consent.
  const [pendingCredential, setPendingCredential] = useState('')
  const [consentChecked, setConsentChecked] = useState(false)
  // The Google callback is created once; it reads the latest props through a ref kept up to date after each render.
  const latest = useRef({ door, externalConsent })
  useEffect(() => {
    latest.current = { door, externalConsent }
  }, [door, externalConsent])

  async function send(credential: string, privacyAccepted: boolean) {
    setIsSending(true)
    setError('')
    try {
      const response = await authenticateWithGoogle({ credential, door: latest.current.door, privacy_accepted: privacyAccepted })
      const decision = decideAfterLogin(latest.current.door, response.user.role)
      if (decision.action === 'refuse') {
        // The API already refuses team accounts; kept as a safety net.
        setError(decision.message)
        return
      }
      startSession(response)
      const notice = [decision.notice, response.linked ? GOOGLE_LINKED_NOTICE : ''].filter(Boolean).join(' ')
      navigate(decision.to, notice ? { state: { loginNotice: notice } } : undefined)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'consent_required') {
        if (latest.current.externalConsent === undefined) {
          setPendingCredential(credential)
        } else {
          setError('Para criar sua conta com o Google, marque o aceite da Política de Privacidade abaixo e toque de novo no botão.')
        }
        return
      }
      setError(err instanceof Error ? err.message : 'Não foi possível entrar com o Google.')
    } finally {
      setIsSending(false)
    }
  }

  useEffect(() => {
    if (!isGoogleButtonAvailable()) return
    let active = true
    loadGoogleIdentity()
      .then((google) => {
        const container = buttonRef.current
        if (!active || !container) return
        google.initialize({
          client_id: googleClientId(),
          ux_mode: 'popup',
          context: 'signin',
          callback: (response) => {
            if (response.credential) {
              const consent = latest.current.externalConsent
              void send(response.credential, consent === undefined ? false : consent)
            }
          },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rendered once; `send` reads props through `latest`
  }, [])

  if (!isGoogleButtonAvailable()) return null

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

      {/* Always mounted: Google draws its button inside this element, outside React's control. */}
      <div ref={buttonRef} className={`min-h-11 max-w-full justify-center overflow-hidden ${pendingCredential ? 'hidden' : 'flex'}`} aria-busy={isSending} />

      {pendingCredential ? (
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-ink-800">Falta um passo para criar sua conta com o Google.</p>
          <label htmlFor="google_privacy" className="flex gap-3 text-sm leading-6 text-ink-700">
            <input
              id="google_privacy"
              type="checkbox"
              checked={consentChecked}
              onChange={(event) => setConsentChecked(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-gold-500"
            />
            <span>
              Li e aceito a{' '}
              <Link to={PRIVACY_POLICY_PATH} target="_blank" rel="noopener noreferrer" className={linkClass}>
                Política de Privacidade
              </Link>{' '}
              e autorizo o tratamento dos meus dados para usar a plataforma.
            </span>
          </label>
          <Button
            type="button"
            isLoading={isSending}
            disabled={!consentChecked || isSending}
            onClick={() => void send(pendingCredential, true)}
          >
            Criar conta e continuar
          </Button>
        </div>
      ) : null}

      {divider === 'below' ? orDivider : null}
    </div>
  )
}
