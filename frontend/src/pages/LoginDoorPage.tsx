import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton'
import { FormField } from '../components/FormField'
import { HireContactLink } from '../components/HireContactLink'
import { Alert, Button } from '../components/ui'
import { useFormState } from '../hooks/useFormState'
import { AuthLayout } from '../layouts/AuthLayout'
import { authenticate, startSession } from '../services/authService'
import { COMPANY_CLOSED_PATH, COMPANY_PORTAL_CLOSED_MESSAGE, isCompanyPortalEnabled } from '../services/companyPortal'
import { googleErrorMessage, isGoogleLoginEnabled } from '../services/googleIdentity'
import { DOOR_COPY, LOGIN_CHOOSER_PATH, decideAfterLogin, isStaffDoor, type LoginDoor } from '../services/loginDoors'

const linkClass = 'font-bold text-brand-700 underline underline-offset-2 hover:text-brand-600'

// One login form, four doors (/entrar/candidato, /entrar/empresa, /equipe, /recrutamento). The API login is the same.
export function LoginDoorPage({ door }: { door: LoginDoor }) {
  const navigate = useNavigate()
  const location = useLocation()
  const copy = DOOR_COPY[door]
  const { values, updateField } = useFormState({ email: '', password: '' })
  const [isLoading, setIsLoading] = useState(false)
  // Coming back from Google with a refusal (?erro=...): shown once, in Portuguese.
  const [searchParams] = useSearchParams()
  const [error, setError] = useState(() => googleErrorMessage(searchParams.get('erro')))
  const [refusal, setRefusal] = useState<{ message: string; link: { label: string; to: string } } | null>(null)
  const successMessage =
    typeof location.state === 'object' && location.state !== null && 'message' in location.state
      ? String(location.state.message)
      : ''

  // Company portal off: old links to /entrar/empresa land on the chooser with the notice.
  if (door === 'empresa' && !isCompanyPortalEnabled()) return <Navigate to={COMPANY_CLOSED_PATH} replace />

  const staffDoor = isStaffDoor(door)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError('')
    setRefusal(null)

    try {
      const response = await authenticate({ email: values.email, password: values.password })
      const decision = decideAfterLogin(door, response.user.role)
      if (decision.action === 'refuse') {
        // Not signed in: the session is only stored when the account may use this door.
        setRefusal({ message: decision.message, link: decision.link })
        return
      }
      startSession(response)
      navigate(decision.to, decision.notice ? { state: { loginNotice: decision.notice } } : undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout title={copy.title} subtitle={copy.subtitle} showHighlights={!staffDoor}>
      {staffDoor ? <meta name="robots" content="noindex, nofollow" /> : null}
      {/* The team keeps e-mail + password only. */}
      {door === 'candidato' || door === 'empresa' ? (
        <div className="mb-5">
          <GoogleSignInButton door={door} />
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="grid gap-5">
        {successMessage ? <Alert tone="success">{successMessage}</Alert> : null}
        {error === COMPANY_PORTAL_CLOSED_MESSAGE ? (
          // A company account: friendly notice and the way to talk to AK, not an error.
          <div className="grid gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
            <p>{error}</p>
            <div>
              <HireContactLink />
            </div>
          </div>
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : null}
        {refusal ? (
          <Alert tone="error">
            {refusal.message}{' '}
            <Link to={refusal.link.to} className={linkClass}>
              {refusal.link.label}
            </Link>
          </Alert>
        ) : null}

        <FormField
          id="email"
          label="E-mail"
          type="email"
          value={values.email}
          placeholder="seu@email.com"
          autoComplete="email"
          onChange={(value) => updateField('email', value)}
        />
        <FormField
          id="password"
          label="Senha"
          type="password"
          value={values.password}
          placeholder="Digite sua senha"
          autoComplete="current-password"
          onChange={(value) => updateField('password', value)}
        />

        <Button type="submit" isLoading={isLoading} className="mt-2 h-12">
          Entrar
        </Button>

        {copy.signUp ? (
          <p className="text-center text-sm text-ink-600">
            {copy.signUp.prompt}{' '}
            <Link to={copy.signUp.to} className={linkClass}>
              {copy.signUp.label}
            </Link>
          </p>
        ) : null}
        {!staffDoor && isGoogleLoginEnabled() ? (
          <p className="text-center text-xs text-ink-600">Criou a conta com o Google? Use o botão "Continuar com o Google".</p>
        ) : null}
        {!staffDoor ? (
          <p className="text-center text-sm">
            <Link to={LOGIN_CHOOSER_PATH} className="font-semibold text-ink-600 hover:text-ink-950">
              ← Não é {door === 'candidato' ? 'candidato' : 'empresa'}? Escolher outra opção
            </Link>
          </p>
        ) : null}
      </form>
    </AuthLayout>
  )
}
