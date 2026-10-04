import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandNotice } from '../../components/brand/BrandNotice'
import { BrandPageTitle } from '../../components/brand/BrandPageTitle'
import { brandButtonVariants, brandCard, brandHeading } from '../../components/brand/styles'
import { ResponsibleSelect } from '../../components/recruiter/ResponsibleSelect'
import { getCurrentUser } from '../../services/authService'
import { formatJobStatus } from '../../services/jobFormat'
import { PIPELINE_COLUMNS, STAGE_SHORT_LABELS, stageTone } from '../../services/pipelineFormat'
import { getRecruiterJobs } from '../../services/pipelineService'
import { getTeam } from '../../services/recruiterService'
import type { RecruiterJobSummary } from '../../types/pipeline'
import type { StaffMember } from '../../types/user'

export function RecruiterHomePage() {
  const user = getCurrentUser()
  const [jobs, setJobs] = useState<RecruiterJobSummary[]>([])
  const [alertDays, setAlertDays] = useState(3)
  const [team, setTeam] = useState<StaffMember[]>([])
  const [onlyMine, setOnlyMine] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getRecruiterJobs(), getTeam()])
      .then(([jobsResponse, teamResponse]) => {
        if (active) {
          setJobs(jobsResponse.jobs)
          setAlertDays(jobsResponse.finalist_alert_days)
          setTeam(teamResponse)
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar as vagas.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const visibleJobs = onlyMine ? jobs.filter((job) => job.recruiter_id === user?.id) : jobs
  const waitingJobs = jobs.filter((job) => job.finalists_waiting > 0)
  const waitingTotal = waitingJobs.reduce((total, job) => total + job.finalists_waiting, 0)

  return (
    <div className="grid gap-6">
      <BrandPageTitle
        eyebrow="Recrutamento"
        title={`Olá, ${user?.name?.split(' ')[0] ?? 'equipe'}.`}
        description="Acompanhe as vagas dos clientes e mova os candidatos pelas etapas."
      />

      {waitingTotal > 0 ? (
        <section className="rounded-xl border border-gold-600/40 bg-gold-50 p-4 sm:p-5" aria-labelledby="waiting-title">
          <h2 id="waiting-title" className="font-semibold text-gold-800">
            {waitingTotal === 1 ? '1 finalista aguarda' : `${waitingTotal} finalistas aguardam`} o cliente há mais de {alertDays} dias
          </h2>
          <ul className="mt-2 grid gap-1 text-sm">
            {waitingJobs.map((job) => (
              <li key={job.id}>
                <Link to={`/recrutador/vagas/${job.id}`} className="font-semibold text-ink-950 underline underline-offset-2">
                  {job.title}
                </Link>{' '}
                <span className="text-ink-700">
                  · {job.company_name} · {job.finalists_waiting} aguardando
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <label className="flex w-fit items-center gap-2 text-sm font-semibold text-ink-700">
        <input type="checkbox" checked={onlyMine} onChange={(event) => setOnlyMine(event.target.checked)} className="h-4 w-4" />
        Mostrar só as minhas vagas
      </label>

      {error ? <BrandNotice tone="error">{error}</BrandNotice> : null}
      {isLoading ? <p className="text-sm text-ink-600">Carregando vagas...</p> : null}
      {!isLoading && !error && visibleJobs.length === 0 ? (
        <BrandNotice>{onlyMine ? 'Nenhuma vaga com você como responsável.' : 'Nenhuma vaga cadastrada ainda.'}</BrandNotice>
      ) : null}

      <ul className="grid gap-4 lg:grid-cols-2">
        {visibleJobs.map((job) => (
          <li key={job.id} className={`${brandCard} grid gap-4 p-5`}>
            <div>
              <p className="text-xs font-semibold text-ink-600">{job.company_name}</p>
              <h2 className={`mt-1 text-lg leading-snug ${brandHeading}`}>
                <Link to={`/recrutador/vagas/${job.id}`} className="hover:underline">
                  {job.title}
                </Link>
              </h2>
              <p className="mt-1 text-sm text-ink-600">
                {formatJobStatus(job.status)}
                {job.location ? ` · ${job.location}` : ''} · {job.active_count} {job.active_count === 1 ? 'candidato ativo' : 'candidatos ativos'}
              </p>
            </div>

            <ul className="flex flex-wrap gap-2" aria-label="Candidatos por etapa">
              {PIPELINE_COLUMNS.map((stage) => (
                <li key={stage} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stageTone(stage)}`}>
                  {STAGE_SHORT_LABELS[stage]}: {job.stage_counts[stage] ?? 0}
                </li>
              ))}
            </ul>

            {job.finalists_waiting > 0 ? (
              <p className="text-sm font-semibold text-gold-800">
                {job.finalists_waiting} {job.finalists_waiting === 1 ? 'finalista aguarda' : 'finalistas aguardam'} o cliente há mais de {alertDays} dias
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <ResponsibleSelect
                job={job}
                team={team}
                onChanged={(updated) =>
                  setJobs((current) =>
                    current.map((item) =>
                      item.id === updated.id ? { ...item, recruiter_id: updated.recruiter_id ?? null, recruiter_name: updated.recruiter_name ?? null } : item,
                    ),
                  )
                }
              />
              <Link to={`/recrutador/vagas/${job.id}`} className={brandButtonVariants.navy}>
                Abrir pipeline
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
