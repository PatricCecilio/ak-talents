import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FormField } from '../components/FormField'
import { Alert, Button } from '../components/ui'
import { useFormState } from '../hooks/useFormState'
import { AuthLayout } from '../layouts/AuthLayout'
import { registerUser } from '../services/authService'
import { PRIVACY_POLICY_PATH } from '../services/privacyPolicy'
import { doorPathForRole } from '../services/loginDoors'
import { roleHome } from '../services/roleHome'
import type { UserRole } from '../types/user'

const roles: Array<{ value: UserRole; label: string; description: string }> = [
  {
    value: 'candidate',
    label: 'Candidato',
    description: 'Crie seu perfil profissional e acompanhe oportunidades.',
  },
  {
    value: 'company',
    label: 'Empresa',
    description: 'Organize vagas, candidatos e processos seletivos.',
  },
]

// /register?tipo=empresa (or candidato) comes from the login doors with the right option already selected.
function roleFromQuery(tipo: string | null): UserRole {
  return tipo === 'empresa' ? 'company' : 'candidate'
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { values, updateField } = useFormState({
    name: '',
    email: '',
    password: '',
    role: roleFromQuery(searchParams.get('tipo')),
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [privacyAccepted, setPrivacyAccepted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!privacyAccepted) {
      setError('Para continuar, leia e aceite a Política de Privacidade.')
      return
    }

    setIsLoading(true)
    try {
      const response = await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role as UserRole,
        company_name: values.role === 'company' ? values.name : undefined,
        privacy_accepted: privacyAccepted,
      })
      navigate(roleHome(response.user.role))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir o cadastro.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Crie seu cadastro"
      subtitle="Defina seu perfil para que a plataforma personalize sua experiência desde a primeira etapa."
    >
      <form onSubmit={handleSubmit} className="grid gap-5">
        {error ? (
          <Alert tone="error">{error}</Alert>
        ) : null}

        <FormField
          id="name"
          label="Nome"
          value={values.name}
          placeholder="Seu nome ou empresa"
          autoComplete="name"
          onChange={(value) => updateField('name', value)}
        />
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
          placeholder="Crie uma senha"
          autoComplete="new-password"
          onChange={(value) => updateField('password', value)}
        />

        <fieldset className="grid gap-3">
          <legend className="text-sm font-bold text-ink-800">Tipo de usuário</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map((role) => (
              <label
                key={role.value}
                className={`cursor-pointer rounded-lg border p-4 transition ${
                  values.role === role.value
                    ? 'border-brand-600 bg-teal-50 ring-4 ring-teal-100'
                    : 'border-slate-300 bg-white hover:border-brand-600'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={role.value}
                  checked={values.role === role.value}
                  onChange={(event) => updateField('role', event.target.value)}
                  className="sr-only"
                />
                <span className="block text-sm font-black text-ink-950">{role.label}</span>
                <span className="mt-1 block text-sm leading-6 text-ink-600">{role.description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor="register_privacy" className="flex gap-3 text-sm font-semibold leading-6 text-ink-700">
          <input
            id="register_privacy"
            type="checkbox"
            checked={privacyAccepted}
            onChange={(event) => setPrivacyAccepted(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-gold-500"
          />
          <span>
            Li e aceito a{' '}
            <a
              href={PRIVACY_POLICY_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-brand-700 underline underline-offset-2 hover:text-brand-600"
            >
              Política de Privacidade
            </a>{' '}
            e autorizo o tratamento dos meus dados para usar a plataforma.
          </span>
        </label>

        <Button
          type="submit"
          isLoading={isLoading}
          className="mt-2 h-12"
        >
          Cadastrar
        </Button>

        <p className="text-center text-sm text-ink-600">
          Já tem conta?{' '}
          <Link to={doorPathForRole(values.role)} className="font-bold text-brand-700 underline underline-offset-2 hover:text-brand-600">
            Entrar
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
