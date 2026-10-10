import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FormField } from '../components/FormField'
import { Alert, Button } from '../components/ui'
import { useFormState } from '../hooks/useFormState'
import { AuthLayout } from '../layouts/AuthLayout'
import { loginUser } from '../services/authService'
import { roleHome } from '../services/roleHome'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { values, updateField } = useFormState({
    email: '',
    password: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const successMessage =
    typeof location.state === 'object' && location.state !== null && 'message' in location.state
      ? String(location.state.message)
      : ''

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await loginUser({
        email: values.email,
        password: values.password,
      })
      navigate(roleHome(response.user.role))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Acesse sua conta"
      subtitle="Entre para acompanhar oportunidades, candidatos, processos e recomendações inteligentes."
    >
      <form onSubmit={handleSubmit} className="grid gap-5">
        {successMessage ? (
          <Alert tone="success">{successMessage}</Alert>
        ) : null}
        {error ? (
          <Alert tone="error">{error}</Alert>
        ) : null}

        <FormField
          id="email"
          label="E-mail"
          type="email"
          value={values.email}
          placeholder="voce@email.com"
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

        <Button
          type="submit"
          isLoading={isLoading}
          className="mt-2 h-12"
        >
          Entrar
        </Button>

        <p className="text-center text-sm text-ink-600">
          Não tem conta?{' '}
          <Link to="/register" className="font-bold text-brand-700 underline underline-offset-2 hover:text-brand-600">
            Criar conta
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
