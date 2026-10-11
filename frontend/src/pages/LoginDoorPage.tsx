import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FormField } from '../components/FormField'
import { Alert, Button } from '../components/ui'
import { useFormState } from '../hooks/useFormState'
import { AuthLayout } from '../layouts/AuthLayout'
import { authenticate, startSession } from '../services/authService'
import { DOOR_COPY, LOGIN_CHOOSER_PATH, decideAfterLogin, type LoginDoor } from '../services/loginDoors'

const linkClass = 'font-bold text-brand-700 underline underline-offset-2 hover:text-brand-600'

// One login form, three doors (/entrar/candidato, /entrar/empresa, /equipe). The API login is the same for all.
export function LoginDoorPage({ door }: { door: LoginDoor }) {
  const navigate = useNavigate()
  const location = useLocation()
  const copy = DOOR_COPY[door]
  const { values, updateField } = useFormState({ email: '', password: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [refusal, setRefusal] = useState<{ message: string; link: { label: string; to: string } } | null>(null)
  const successMessage =
    typeof location.state === 'object' && location.state !== null && 'message' in location.state
      ? String(location.state.message)
      : ''

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
    <AuthLayout title={copy.title} subtitle={copy.subtitle}>
      {door === 'equipe' ? <meta name="robots" content="noindex, nofollow" /> : null}
      <form onSubmit={handleSubmit} className="grid gap-5">
        {successMessage ? <Alert tone="success">{successMessage}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
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
        {door !== 'equipe' ? (
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
