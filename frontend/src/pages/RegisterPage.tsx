import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormField } from '../components/FormField'
import { Alert, Button } from '../components/ui'
import { useFormState } from '../hooks/useFormState'
import { AuthLayout } from '../layouts/AuthLayout'
import { registerUser } from '../services/authService'
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

export function RegisterPage() {
  const navigate = useNavigate()
  const { values, updateField } = useFormState({
    name: '',
    email: '',
    password: '',
    role: 'candidate',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role as UserRole,
        company_name: values.role === 'company' ? values.name : undefined,
      })
      navigate('/login', {
        state: { message: 'Cadastro realizado com sucesso. Entre com seu email e senha.' },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel concluir o cadastro.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Crie seu cadastro"
      subtitle="Defina seu perfil para que a plataforma personalize sua experiencia desde a primeira etapa."
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
          label="Email"
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
          placeholder="Crie uma senha"
          autoComplete="new-password"
          onChange={(value) => updateField('password', value)}
        />

        <fieldset className="grid gap-3">
          <legend className="text-sm font-bold text-ink-800">Tipo de usuario</legend>
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

        <Button
          type="submit"
          isLoading={isLoading}
          className="mt-2 h-12"
        >
          Cadastrar
        </Button>
      </form>
    </AuthLayout>
  )
}
