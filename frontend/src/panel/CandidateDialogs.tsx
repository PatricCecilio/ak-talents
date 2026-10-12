import type { FormEvent } from 'react'
import { useState } from 'react'
import { Input, Textarea } from '../components/ui'
import { FIELD_MESSAGES, isValidEmail, normalizeOptionalUrl } from '../services/fieldValidation'
import { eraseCandidate, updateCandidate } from './panelApi'
import { erasureConfirmed } from './panelFormat'
import { PanelDialog } from './PanelUi'
import { panelButton } from './panelStyles'
import type { CandidateDetail } from './types'

type EditErrors = Partial<Record<'full_name' | 'phone' | 'city' | 'email' | 'linkedin_url' | 'resume_url', string>>

// "Editar dados": what the AK team keeps up to date. Same essentials and link rules as everywhere else.
export function EditCandidateDialog({ candidate, onClose, onSaved }: { candidate: CandidateDetail; onClose: () => void; onSaved: (saved: CandidateDetail) => void }) {
  const [values, setValues] = useState({
    full_name: candidate.name,
    phone: candidate.phone ?? '',
    city: candidate.city ?? '',
    email: candidate.email ?? '',
    neighborhood: candidate.neighborhood ?? '',
    desired_role: candidate.desired_role ?? '',
    experience_years: candidate.experience_years?.toString() ?? '',
    skills: candidate.skills ?? '',
    linkedin_url: candidate.linkedin_url ?? '',
    resume_url: candidate.resume_url ?? '',
  })
  const [errors, setErrors] = useState<EditErrors>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next: EditErrors = {}
    if (values.full_name.trim().length < 2) next.full_name = FIELD_MESSAGES.fullName
    if (values.phone.replace(/\D+/g, '').length < 8) next.phone = FIELD_MESSAGES.phone
    if (!values.city.trim()) next.city = FIELD_MESSAGES.city
    if (values.email.trim() && !isValidEmail(values.email)) next.email = FIELD_MESSAGES.email
    if (normalizeOptionalUrl(values.linkedin_url) === null) next.linkedin_url = FIELD_MESSAGES.linkedin
    if (normalizeOptionalUrl(values.resume_url) === null) next.resume_url = FIELD_MESSAGES.resume
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    setError('')
    try {
      const years = values.experience_years.trim().replace(',', '.')
      const saved = await updateCandidate(candidate.id, {
        full_name: values.full_name.trim(),
        phone: values.phone.trim(),
        city: values.city.trim(),
        email: values.email.trim() || null,
        neighborhood: values.neighborhood.trim() || null,
        state: candidate.state,
        desired_role: values.desired_role.trim() || null,
        experience_years: years ? Number(years) : null,
        skills: values.skills.trim() || null,
        linkedin_url: normalizeOptionalUrl(values.linkedin_url) || null,
        portfolio_url: candidate.portfolio_url,
        resume_url: normalizeOptionalUrl(values.resume_url) || null,
      })
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PanelDialog title={`Editar dados de ${candidate.name}`} onClose={onClose} wide>
      <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-4">
        {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="edit-name" label="Nome completo" value={values.full_name} error={errors.full_name} onChange={(event) => update('full_name', event.target.value)} />
          <Input id="edit-phone" label="WhatsApp" type="tel" inputMode="tel" value={values.phone} error={errors.phone} onChange={(event) => update('phone', event.target.value)} />
          <Input id="edit-city" label="Cidade" value={values.city} error={errors.city} onChange={(event) => update('city', event.target.value)} />
          <Input id="edit-neighborhood" label="Bairro (opcional)" value={values.neighborhood} onChange={(event) => update('neighborhood', event.target.value)} />
          <Input
            id="edit-email"
            label={candidate.has_account ? 'E-mail (da conta, não editável)' : 'E-mail (opcional)'}
            type="email"
            value={values.email}
            readOnly={candidate.has_account}
            error={errors.email}
            onChange={(event) => update('email', event.target.value)}
          />
          <Input id="edit-role" label="Cargo desejado (opcional)" value={values.desired_role} onChange={(event) => update('desired_role', event.target.value)} />
          <Input id="edit-years" label="Anos de experiência (opcional)" inputMode="decimal" value={values.experience_years} onChange={(event) => update('experience_years', event.target.value)} />
          <Input id="edit-linkedin" label="LinkedIn (opcional)" inputMode="url" value={values.linkedin_url} error={errors.linkedin_url} onChange={(event) => update('linkedin_url', event.target.value)} />
        </div>
        <Input id="edit-resume" label="Currículo, link (opcional)" inputMode="url" value={values.resume_url} error={errors.resume_url} onChange={(event) => update('resume_url', event.target.value)} />
        <Textarea id="edit-skills" label="Habilidades (opcional)" rows={3} value={values.skills} onChange={(event) => update('skills', event.target.value)} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={panelButton.outline} onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className={panelButton.navy} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </PanelDialog>
  )
}

// "Excluir dados (LGPD)": admin only, strong confirmation (type the name), cannot be undone.
export function EraseCandidateDialog({ candidate, onClose, onErased }: { candidate: { id: number; name: string }; onClose: () => void; onErased: () => void }) {
  const [typed, setTyped] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const ready = understood && erasureConfirmed(typed, candidate.name)

  async function erase() {
    setSaving(true)
    setError('')
    try {
      await eraseCandidate(candidate.id, typed)
      onErased()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir os dados.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PanelDialog title="Excluir dados do candidato (LGPD)" onClose={onClose}>
      <div className="grid gap-4 text-sm text-ink-700">
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 font-semibold text-red-800">Esta ação não pode ser desfeita.</p>
        <p>
          Vamos apagar os dados pessoais de <strong className="text-ink-950">{candidate.name}</strong>: nome, e-mail, telefone, cidade, links e
          currículo, respostas de triagem, cartas e o texto das anotações. Se a pessoa tiver conta no site, ela é desativada.
        </p>
        <p>As candidaturas continuam como “Candidato removido”, só para os números. Fica registrado quem excluiu e quando.</p>
        <label className="flex gap-3">
          <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} className="mt-1 h-4 w-4" />
          <span>Entendi que não dá para desfazer.</span>
        </label>
        <Input id="erase-confirmation" label={`Para confirmar, digite o nome: ${candidate.name}`} value={typed} autoComplete="off" onChange={(event) => setTyped(event.target.value)} />
        {error ? <p role="alert" className="font-semibold text-red-700">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={panelButton.outline} onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className={`${panelButton.navy} bg-red-700 hover:bg-red-800`} disabled={!ready || saving} onClick={() => void erase()}>
            {saving ? 'Excluindo…' : 'Excluir dados definitivamente'}
          </button>
        </div>
      </div>
    </PanelDialog>
  )
}
