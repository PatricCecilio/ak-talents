import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createRecruiter, getRecruiters } from '../../services/adminService'
import type { StaffMember } from '../../types/user'
import { BrandButton } from '../brand/BrandButton'
import { BrandNotice } from '../brand/BrandNotice'
import { brandButtonVariants, brandCard, brandHeading, brandInput, brandLabel } from '../brand/styles'

const emptyForm = { name: '', email: '', password: '' }

/** Admin-only: list and create internal recruiters (the public sign-up never offers this role). */
export function RecruiterTeamSection() {
  const [recruiters, setRecruiters] = useState<StaffMember[]>([])
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    getRecruiters()
      .then((response) => {
        if (active) setRecruiters(response)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar a equipe.')
      })
    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setIsSaving(true)
    try {
      const created = await createRecruiter(form)
      setRecruiters((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(emptyForm)
      setSuccess(`Recrutador ${created.name} criado. Envie o e-mail e a senha para a pessoa por um canal seguro.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o recrutador.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className={`${brandCard} grid gap-5 p-5 sm:p-6`} aria-labelledby="team-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="team-title" className={`text-xl ${brandHeading}`}>
            Equipe de recrutamento
          </h2>
          <p className="mt-1 text-sm text-ink-600">Recrutadores operam vagas e candidaturas. Não aprovam empresas nem gerenciam usuários.</p>
        </div>
        <Link to="/recrutador" className={brandButtonVariants.navy}>
          Abrir área de recrutamento
        </Link>
      </div>

      {recruiters.length ? (
        <ul className="grid gap-2">
          {recruiters.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <span className="font-semibold text-ink-950">{member.name}</span>
              <span className="text-ink-600">
                {member.email}
                {member.is_active ? '' : ' · desativado'}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-600">Nenhum recrutador cadastrado ainda.</p>
      )}

      <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-3">
        <label className={brandLabel}>
          Nome
          <input className={brandInput} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label className={brandLabel}>
          E-mail
          <input className={brandInput} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        </label>
        <label className={brandLabel}>
          Senha inicial (mín. 12 caracteres)
          <input
            className={brandInput}
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />
        </label>
        <div className="md:col-span-3">
          <BrandButton type="submit" variant="primary" isLoading={isSaving}>
            Criar recrutador
          </BrandButton>
        </div>
      </form>

      {error ? <BrandNotice tone="error">{error}</BrandNotice> : null}
      {success ? <BrandNotice tone="success">{success}</BrandNotice> : null}
    </section>
  )
}
