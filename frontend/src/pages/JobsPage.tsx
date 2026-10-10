import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Card, PageHeader } from '../components/ui'
import { Container } from '../components/Container'
import { JobsLoading } from '../components/JobsLoading'
import { JobsUnavailableNotice } from '../components/JobsUnavailableNotice'
import { LoadErrorState } from '../components/LoadErrorState'
import { ApiError } from '../services/api'
import { formatSalary, formatWorkMode } from '../services/jobFormat'
import { getJobs } from '../services/jobService'
import type { Job } from '../types/user'

type LoadState = 'loading' | 'ready' | 'network-error' | 'server-error'

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [reloadKey, setReloadKey] = useState(0)

  function loadJobs() {
    setLoadState('loading')
    setReloadKey((key) => key + 1)
  }

  useEffect(() => {
    let active = true

    getJobs()
      .then((response) => {
        if (active) {
          setJobs(response)
          setLoadState('ready')
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setJobs([])
          setLoadState(err instanceof ApiError && err.isNetworkError ? 'network-error' : 'server-error')
        }
      })

    return () => {
      active = false
    }
  }, [reloadKey])

  const hasError = loadState === 'network-error' || loadState === 'server-error'

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Vagas"
        title="Oportunidades abertas."
        description="Veja as vagas publicadas pela AK Talent e escolha uma oportunidade para conhecer os detalhes."
      />

      <div className="mt-8 grid gap-4">
        {loadState === 'loading' ? <JobsLoading /> : null}

        {hasError ? (
          <LoadErrorState
            title="Não conseguimos carregar as vagas agora."
            description={
              loadState === 'network-error'
                ? 'Confira sua conexão com a internet e toque em "Tentar novamente".'
                : 'Pode ser uma instabilidade rápida. Toque em "Tentar novamente" em alguns instantes.'
            }
            onRetry={() => loadJobs()}
          />
        ) : null}

        {loadState === 'ready' && jobs.length === 0 ? (
          <JobsUnavailableNotice
            title="Nenhuma vaga aberta agora"
            description="Estamos preparando novas oportunidades. Volte em alguns dias para conferir."
          />
        ) : null}

        {jobs.map((job) => {
          const salary = formatSalary(job)
          const workMode = formatWorkMode(job.work_mode)

          return (
            <Card key={job.id} className="p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  {workMode ? <Badge>{workMode}</Badge> : null}
                  <h2 className="mt-3 text-2xl font-black text-ink-950">{job.title}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-600">{job.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em] text-ink-600">
                    {job.location ? <span className="rounded-lg bg-slate-100 px-3 py-2">{job.location}</span> : null}
                    {salary ? <span className="rounded-lg bg-slate-100 px-3 py-2">{salary}</span> : null}
                  </div>
                </div>

                <Link
                  to={`/vagas/${job.slug}`}
                  className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg bg-brand-700 px-5 text-sm font-black text-white shadow-lg shadow-slate-900/10 transition hover:bg-brand-600"
                >
                  Ver vaga
                </Link>
              </div>
            </Card>
          )
        })}
      </div>
    </Container>
  )
}
