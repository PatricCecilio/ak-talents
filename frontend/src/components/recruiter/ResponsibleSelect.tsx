import { useState } from 'react'
import { setJobResponsible } from '../../services/recruiterService'
import type { AdminJob, StaffMember } from '../../types/user'

interface ResponsibleSelectProps {
  job: AdminJob
  team: StaffMember[]
  onChanged: (job: AdminJob) => void
}

/** "Recrutador responsável" for a job. Saves on change; empty means nobody assigned. */
export function ResponsibleSelect({ job, team, onChanged }: ResponsibleSelectProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleChange(value: string) {
    setIsSaving(true)
    setError('')
    try {
      onChanged(await setJobResponsible(job.id, value ? Number(value) : null))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o responsável.')
    } finally {
      setIsSaving(false)
    }
  }

  const selectId = `responsible-${job.id}`
  return (
    <div className="grid gap-1">
      <label htmlFor={selectId} className="text-xs font-semibold text-ink-600">
        Recrutador responsável
      </label>
      <select
        id={selectId}
        value={job.recruiter_id ?? ''}
        disabled={isSaving}
        onChange={(event) => void handleChange(event.target.value)}
        className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-ink-950 outline-none focus:border-gold-600 focus:ring-4 focus:ring-gold-100 disabled:opacity-60"
      >
        <option value="">Sem responsável</option>
        {team.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
            {member.role === 'admin' ? ' (admin)' : ''}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}
    </div>
  )
}
