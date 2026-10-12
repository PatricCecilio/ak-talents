import { useEffect, useState } from 'react'
import { getAdminJobs } from '../services/adminService'
import type { AdminJob } from '../types/user'
import { referToJob } from './panelApi'
import { PanelDialog, PanelSelect } from './PanelUi'
import { panelButton } from './panelStyles'

// "Indicar para outra vaga": a new application in "Nova" of the chosen job, with the note
// "Indicado a partir da vaga X". The current application does not change.
export function ReferDialog({
  applicationId,
  candidateName,
  fromJobId,
  onClose,
  onDone,
}: {
  applicationId: number
  candidateName: string
  fromJobId: number
  onClose: () => void
  onDone: (jobTitle: string) => void
}) {
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [jobId, setJobId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAdminJobs()
      .then((list) => setJobs(list.filter((job) => job.id !== fromJobId && (job.status === 'approved' || job.status === 'draft'))))
      .catch(() => setJobs([]))
  }, [fromJobId])

  async function submit() {
    if (!jobId) {
      setError('Escolha a vaga.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await referToJob(applicationId, Number(jobId))
      onDone(jobs.find((job) => String(job.id) === jobId)?.title ?? 'a outra vaga')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível indicar o candidato.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PanelDialog title={`Indicar ${candidateName} para outra vaga`} onClose={onClose}>
      <p className="text-sm text-ink-700">Cria uma candidatura na etapa Nova da vaga escolhida. A candidatura atual não muda.</p>
      <div className="mt-4 grid gap-2">
        <PanelSelect label="Vaga" value={jobId} onChange={setJobId}>
          <option value="">Escolha a vaga</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title} · {job.company_name}
            </option>
          ))}
        </PanelSelect>
        {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={panelButton.outline} onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="button" className={panelButton.navy} onClick={() => void submit()} disabled={saving}>{saving ? 'Indicando…' : 'Indicar'}</button>
      </div>
    </PanelDialog>
  )
}
