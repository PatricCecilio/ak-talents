import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Input, Select } from '../components/ui'
import { getAdminJobs } from '../services/adminService'
import { getCurrentUser } from '../services/authService'
import { FIELD_MESSAGES, isValidEmail } from '../services/fieldValidation'
import type { AdminJob } from '../types/user'
import { createManualCandidate } from './panelApi'
import { PanelDialog } from './PanelUi'
import { panelButton } from './panelStyles'

interface AddCandidateDialogProps {
  /** Fixed job (page of a job); otherwise the job is optional and chosen here. */
  jobId?: number
  jobTitle?: string
  onClose: () => void
  onCreated: (candidateId: number) => void
}

type Errors = Partial<Record<'full_name' | 'phone' | 'city' | 'email' | 'job_id' | 'authorization', string>>

// Manual registration by AK: only the essentials, and the candidate's authorization is required (recorded with
// date, author and the origin "Cadastro manual pela AK").
export function AddCandidateDialog({ jobId, jobTitle, onClose, onCreated }: AddCandidateDialogProps) {
  // A recruiter registers into one of their jobs; otherwise they would not see the person afterwards.
  const jobRequired = getCurrentUser()?.role !== 'admin'
  const [values, setValues] = useState({ full_name: '', phone: '', city: '', email: '', job_id: jobId ? String(jobId) : '' })
  const [authorized, setAuthorized] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [jobs, setJobs] = useState<AdminJob[]>([])

  useEffect(() => {
    if (jobId) return
    getAdminJobs()
      .then((list) => setJobs(list.filter((job) => job.status === 'approved' || job.status === 'draft')))
      .catch(() => setJobs([]))
  }, [jobId])

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next: Errors = {}
    if (values.full_name.trim().length < 2) next.full_name = FIELD_MESSAGES.fullName
    if (values.phone.replace(/\D+/g, '').length < 8) next.phone = FIELD_MESSAGES.phone
    if (!values.city.trim()) next.city = FIELD_MESSAGES.city
    if (values.email.trim() && !isValidEmail(values.email)) next.email = FIELD_MESSAGES.email
    if (jobRequired && !values.job_id) next.job_id = 'Escolha uma das suas vagas.'
    if (!authorized) next.authorization = 'Confirme que o candidato autorizou o uso dos dados.'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    setError('')
    try {
      const created = await createManualCandidate({
        full_name: values.full_name.trim(),
        phone: values.phone.trim(),
        city: values.city.trim(),
        email: values.email.trim() || null,
        authorization_confirmed: true,
        job_id: values.job_id ? Number(values.job_id) : null,
      })
      onCreated(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cadastrar o candidato.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PanelDialog title={jobTitle ? `Adicionar candidato · ${jobTitle}` : 'Novo candidato'} onClose={onClose}>
      <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-4">
        {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
        <Input id="manual-name" label="Nome completo" value={values.full_name} error={errors.full_name} autoComplete="off" onChange={(event) => update('full_name', event.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="manual-phone" label="WhatsApp" type="tel" inputMode="tel" value={values.phone} placeholder="(41) 99999-0000" error={errors.phone} onChange={(event) => update('phone', event.target.value)} />
          <Input id="manual-city" label="Cidade" value={values.city} error={errors.city} onChange={(event) => update('city', event.target.value)} />
        </div>
        <Input id="manual-email" label="E-mail (opcional)" type="email" inputMode="email" value={values.email} error={errors.email} onChange={(event) => update('email', event.target.value)} />
        {jobId ? null : (
          <Select
            id="manual-job"
            label={jobRequired ? 'Vaga' : 'Colocar na vaga (opcional)'}
            value={values.job_id}
            error={errors.job_id}
            onChange={(event) => update('job_id', event.target.value)}
          >
            <option value="">{jobRequired ? 'Escolha a vaga' : 'Só no banco de talentos'}</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title} · {job.company_name}
              </option>
            ))}
          </Select>
        )}
        <label htmlFor="manual-authorization" className="flex gap-3 rounded-lg border border-slate-200 p-3 text-sm leading-6 text-ink-700">
          <input id="manual-authorization" type="checkbox" checked={authorized} onChange={(event) => { setAuthorized(event.target.checked); setErrors((c) => ({ ...c, authorization: undefined })) }} className="mt-1 h-4 w-4" />
          <span>
            <strong className="text-ink-950">O candidato autorizou o uso dos dados dele pela AK Talent</strong> (por exemplo, pelo WhatsApp). Fica
            registrado com a data e o seu nome, como “Cadastro manual pela AK”.
          </span>
        </label>
        {errors.authorization ? <p role="alert" className="-mt-2 text-sm font-semibold text-red-700">{errors.authorization}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={panelButton.outline} onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className={panelButton.navy} disabled={saving}>{saving ? 'Salvando…' : 'Cadastrar candidato'}</button>
        </div>
      </form>
    </PanelDialog>
  )
}
