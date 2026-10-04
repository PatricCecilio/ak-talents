import { useEffect, useState } from 'react'
import { BrandNotice } from '../../components/brand/BrandNotice'
import { BrandPageTitle } from '../../components/brand/BrandPageTitle'
import { brandCard, brandHeading } from '../../components/brand/styles'
import { ResponsibleSelect } from '../../components/recruiter/ResponsibleSelect'
import { getAdminJobs } from '../../services/adminService'
import { getCurrentUser } from '../../services/authService'
import { formatJobStatus } from '../../services/jobFormat'
import { getTeam } from '../../services/recruiterService'
import type { AdminJob, StaffMember } from '../../types/user'

export function RecruiterHomePage() {
  const user = getCurrentUser()
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [team, setTeam] = useState<StaffMember[]>([])
  const [onlyMine, setOnlyMine] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getAdminJobs(), getTeam()])
      .then(([jobsResponse, teamResponse]) => {
        if (active) {
          setJobs(jobsResponse)
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

  return (
    <div className="grid gap-6">
      <BrandPageTitle
        eyebrow="Recrutamento"
        title={`Olá, ${user?.name?.split(' ')[0] ?? 'equipe'}.`}
        description="Todas as vagas abertas pelos clientes. Defina quem é o responsável por cada uma."
      />

      <label className="flex w-fit items-center gap-2 text-sm font-semibold text-ink-700">
        <input type="checkbox" checked={onlyMine} onChange={(event) => setOnlyMine(event.target.checked)} className="h-4 w-4" />
        Mostrar só as minhas vagas
      </label>

      {error ? <BrandNotice tone="error">{error}</BrandNotice> : null}
      {isLoading ? <p className="text-sm text-ink-600">Carregando vagas...</p> : null}
      {!isLoading && !error && visibleJobs.length === 0 ? (
        <BrandNotice>{onlyMine ? 'Nenhuma vaga com você como responsável.' : 'Nenhuma vaga cadastrada ainda.'}</BrandNotice>
      ) : null}

      <ul className="grid gap-3 md:grid-cols-2">
        {visibleJobs.map((job) => (
          <li key={job.id} className={`${brandCard} grid gap-4 p-5`}>
            <div>
              <p className="text-xs font-semibold text-ink-600">{job.company_name}</p>
              <h2 className={`mt-1 text-lg leading-snug ${brandHeading}`}>{job.title}</h2>
              <p className="mt-1 text-sm text-ink-600">
                {formatJobStatus(job.status)}
                {job.location ? ` · ${job.location}` : ''}
              </p>
            </div>
            <ResponsibleSelect
              job={job}
              team={team}
              onChanged={(updated) => setJobs((current) => current.map((item) => (item.id === updated.id ? updated : item)))}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
