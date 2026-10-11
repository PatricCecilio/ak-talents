import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, LoadingSpinner } from '../components/ui'
import { AuthLayout } from '../layouts/AuthLayout'
import { completeGoogleConsent, exchangeGoogleCode, startSession } from '../services/authService'
import { GOOGLE_LINKED_NOTICE } from '../services/googleIdentity'
import { LOGIN_CHOOSER_PATH, decideAfterLogin } from '../services/loginDoors'
import { PRIVACY_POLICY_PATH } from '../services/privacyPolicy'
import type { GoogleSignInResponse } from '../types/user'

const linkClass = 'font-bold text-brand-700 underline underline-offset-2 hover:text-brand-600'

// Read once and removed from the address bar right away: the one-time code must not stay in the history.
function takeCodesFromUrl(): { codigo: string; consentimento: string } {
  const params = new URLSearchParams(window.location.search)
  const codes = { codigo: params.get('codigo') ?? '', consentimento: params.get('consentimento') ?? '' }
  if (codes.codigo || codes.consentimento) window.history.replaceState(null, '', window.location.pathname)
  return codes
}

// /entrar/google: where the API sends people back after Google (redirect mode).
export function GoogleReturnPage() {
  const navigate = useNavigate()
  const [codes] = useState(takeCodesFromUrl)
  const [error, setError] = useState(codes.codigo || codes.consentimento ? '' : 'Link de login inválido.')
  const [consentChecked, setConsentChecked] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const exchanged = useRef(false)

  function enter(response: GoogleSignInResponse) {
    const door = response.door ?? 'candidato'
    const decision = decideAfterLogin(door, response.user.role)
    if (decision.action === 'refuse') {
      setError(decision.message)
      return
    }
    startSession(response)
    const notice = [decision.notice, response.linked ? GOOGLE_LINKED_NOTICE : ''].filter(Boolean).join(' ')
    navigate(decision.to, { replace: true, ...(notice ? { state: { loginNotice: notice } } : {}) })
  }

  useEffect(() => {
    // One-time code: exchanged once even when React runs effects twice in development.
    if (!codes.codigo || exchanged.current) return
    exchanged.current = true
    exchangeGoogleCode(codes.codigo)
      .then(enter)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Não foi possível entrar com o Google.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once for the code read from the URL
  }, [])

  async function acceptAndCreate() {
    setIsSending(true)
    setError('')
    try {
      enter(await completeGoogleConsent(codes.consentimento))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar sua conta.')
    } finally {
      setIsSending(false)
    }
  }

  const askConsent = Boolean(codes.consentimento) && !error

  return (
    <AuthLayout
      title={askConsent ? 'Falta um passo' : 'Entrando com o Google'}
      subtitle={askConsent ? 'Para criar sua conta com o Google, leia e aceite a Política de Privacidade.' : 'Só um instante.'}
      showHighlights={false}
    >
      <meta name="robots" content="noindex, nofollow" />
      <div className="grid gap-5">
        {error ? (
          <>
            <Alert tone="error">{error}</Alert>
            <Link to={LOGIN_CHOOSER_PATH} className={`${linkClass} text-center text-sm`}>
              Voltar para o login
            </Link>
          </>
        ) : askConsent ? (
          <>
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
            <Button type="button" isLoading={isSending} disabled={!consentChecked || isSending} onClick={() => void acceptAndCreate()}>
              Criar conta e continuar
            </Button>
            <Link to={LOGIN_CHOOSER_PATH} className="text-center text-sm font-semibold text-ink-600 hover:text-ink-950">
              Cancelar
            </Link>
          </>
        ) : (
          <LoadingSpinner label="Entrando..." />
        )}
      </div>
    </AuthLayout>
  )
}
