import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { createAdminJob, getAdminJob, updateAdminJob } from '../../services/adminService'
import { EMPTY_JOB_FORM, JOB_STATUS_OPTIONS, jobFormToPayload, jobToForm, type JobFormValues } from '../../services/adminForms'
import { CONTRACT_TYPE_OPTIONS } from '../../services/jobFormat'
import { getTeam } from '../../services/recruiterService'
import type { AdminCompany, AdminJob, StaffMember } from '../../types/user'
import { Alert, Button, Input, LoadingSpinner, Select, Textarea } from '../ui'

interface JobFormProps {
  /** Editing this job; creating a new one when absent. */
  jobId?: number
  companies: AdminCompany[]
  onSaved: (job: AdminJob, created: boolean) => void
  onCancel: () => void
}

// A job opened by AK for a client company: every field candidates see, the responsible recruiter and the status.
// No approval step: "Publicada" goes straight to the site.
export function JobForm({ jobId, companies, onSaved, onCancel }: JobFormProps) {
  const [values, setValues] = useState<JobFormValues>(EMPTY_JOB_FORM)
  const [team, setTeam] = useState<StaffMember[]>([])
  const [isLoading, setIsLoading] = useState(jobId !== undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const prefix = jobId ? `job-${jobId}` : 'job-new'

  useEffect(() => {
    let active = true
    Promise.all([getTeam(), jobId ? getAdminJob(jobId) : Promise.resolve(null)])
      .then(([members, job]) => {
        if (!active) return
        setTeam(members)
        if (job) setValues(jobToForm(job))
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar a vaga.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [jobId])

  function update(field: keyof JobFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const { payload, error: problem } = jobFormToPayload(values)
    if (!payload) {
      setError(problem)
      return
    }
    setIsSaving(true)
    setError('')
    try {
      const saved = jobId ? await updateAdminJob(jobId, payload) : await createAdminJob(payload)
      onSaved(saved, !jobId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a vaga.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gold-100 bg-gold-50/60 p-5">
        <LoadingSpinner label="Carregando a vaga..." />
      </div>
    )
  }

  // Deactivated companies only appear when the job already belongs to them.
  const companyOptions = companies.filter((company) => company.is_active !== false || String(company.id) === values.company_id)

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-gold-100 bg-gold-50/60 p-4 sm:p-5">
      <h3 className="text-lg font-black text-ink-950">{jobId ? 'Editar vaga' : 'Nova vaga'}</h3>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Select id={`${prefix}-company`} label="Empresa" value={values.company_id} required onChange={(event) => update('company_id', event.target.value)}>
          <option value="">Escolha a empresa</option>
          {companyOptions.map((company) => (
            <option key={company.id} value={company.id}>
              {company.company_name}
              {company.is_active === false ? ' (desativada)' : ''}
            </option>
          ))}
        </Select>
        <Select id={`${prefix}-recruiter`} label="Recrutador responsável" value={values.recruiter_id} onChange={(event) => update('recruiter_id', event.target.value)}>
          <option value="">Sem responsável</option>
          {team.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
              {member.role === 'admin' ? ' (admin)' : ''}
            </option>
          ))}
        </Select>
      </div>

      <Input
        id={`${prefix}-title`}
        label="Título da vaga"
        value={values.title}
        placeholder="Atendente de loja"
        required
        onChange={(event) => update('title', event.target.value)}
      />
      <Textarea
        id={`${prefix}-description`}
        label="Descrição da vaga"
        value={values.description}
        placeholder="Atender clientes no balcão, organizar a loja, operar o caixa e repor produtos."
        rows={5}
        required
        onChange={(event) => update('description', event.target.value)}
      />
      <Textarea
        id={`${prefix}-requirements`}
        label="Requisitos"
        value={values.requirements}
        placeholder="Ensino médio completo. Experiência com caixa é um diferencial."
        rows={3}
        onChange={(event) => update('requirements', event.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id={`${prefix}-salary-min`}
          label="Salário mínimo"
          type="number"
          min={0}
          value={values.salary_min}
          placeholder="1800"
          onChange={(event) => update('salary_min', event.target.value)}
        />
        <Input
          id={`${prefix}-salary-max`}
          label="Salário máximo"
          type="number"
          min={0}
          value={values.salary_max}
          placeholder="2200"
          onChange={(event) => update('salary_max', event.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id={`${prefix}-location`}
          label="Cidade da vaga"
          value={values.location}
          placeholder="Curitiba, PR"
          onChange={(event) => update('location', event.target.value)}
        />
        <Select id={`${prefix}-work-mode`} label="Modelo de trabalho" value={values.work_mode} onChange={(event) => update('work_mode', event.target.value)}>
          <option value="onsite">Presencial</option>
          <option value="hybrid">Híbrido</option>
          <option value="remote">Remoto</option>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select id={`${prefix}-contract`} label="Tipo de contrato" value={values.contract_type} onChange={(event) => update('contract_type', event.target.value)}>
          <option value="">Selecione</option>
          {CONTRACT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Input
          id={`${prefix}-openings`}
          label="Quantidade de vagas"
          type="number"
          min={1}
          max={999}
          value={values.openings}
          placeholder="1"
          onChange={(event) => update('openings', event.target.value)}
        />
      </div>
      <Input
        id={`${prefix}-schedule`}
        label="Horário ou escala"
        value={values.schedule}
        placeholder="Seg a sáb, 8h às 16h20 (escala 6x1)"
        onChange={(event) => update('schedule', event.target.value)}
      />
      <Textarea
        id={`${prefix}-benefits`}
        label="Benefícios"
        value={values.benefits}
        placeholder="Vale-transporte, vale-refeição, plano de saúde..."
        rows={3}
        onChange={(event) => update('benefits', event.target.value)}
      />

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-bold text-ink-800">Status</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {JOB_STATUS_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-lg border bg-white p-3 text-sm transition ${
                values.status === option.value ? 'border-gold-600 ring-2 ring-gold-100' : 'border-slate-300 hover:border-slate-400'
              }`}
            >
              <input
                type="radio"
                name={`${prefix}-status`}
                value={option.value}
                checked={values.status === option.value}
                onChange={() => update('status', option.value)}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block font-black text-ink-950">{option.label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-ink-600">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isSaving}>
          {jobId ? 'Salvar vaga' : 'Criar vaga'}
        </Button>
      </div>
    </form>
  )
}
