import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Button, Card, EmptyState, LoadingSpinner, PageHeader } from '../components/ui'
import { Container } from '../components/Container'
import { getJobs } from '../services/jobService'
import type { Job } from '../types/user'

function formatSalary(job: Job) {
  if (job.salary_min && job.salary_max) {
    return `R$ ${job.salary_min.toLocaleString('pt-BR')} - R$ ${job.salary_max.toLocaleString('pt-BR')}`
  }

  if (job.salary_min) {
    return `A partir de R$ ${job.salary_min.toLocaleString('pt-BR')}`
  }

  if (job.salary_max) {
    return `Ate R$ ${job.salary_max.toLocaleString('pt-BR')}`
  }

  return ''
}

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadJobs = useCallback(async (isMounted: () => boolean = () => true) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await getJobs()
      if (isMounted()) {
        setJobs(response)
      }
    } catch {
      if (isMounted()) {
        setJobs([])
        setError('Nao foi possivel carregar as vagas no momento.')
      }
    } finally {
      if (isMounted()) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    getJobs()
      .then((response) => {
        if (isMounted) {
          setJobs(response)
        }
      })
      .catch(() => {
        if (isMounted) {
          setJobs([])
          setError('Nao foi possivel carregar as vagas no momento.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Vagas"
        title="Oportunidades abertas."
        description="Veja as vagas publicadas pela AK Talent e escolha uma oportunidade para conhecer os detalhes."
      />

      <div className="mt-8 grid gap-4">
        {isLoading ? (
          <Card className="p-6">
            <LoadingSpinner label="Carregando vagas..." />
          </Card>
        ) : null}

        {!isLoading && error ? (
          <Alert tone="error">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p>{error}</p>
                <p className="mt-1 font-normal text-red-600">Tente novamente em alguns instantes.</p>
              </div>
              <Button type="button" variant="danger" onClick={() => void loadJobs()}>
                Tentar novamente
              </Button>
            </div>
          </Alert>
        ) : null}

        {!isLoading && !error && jobs.length === 0 ? (
          <EmptyState title="No momento nao temos vagas disponiveis." description="Volte em breve para conferir novas oportunidades." />
        ) : null}

        {jobs.map((job) => {
          const salary = formatSalary(job)

          return (
            <Card key={job.id} className="p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  {job.work_mode ? <Badge>{job.work_mode}</Badge> : null}
                  <h2 className="mt-3 text-2xl font-black text-ink-950">{job.title}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-600">{job.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em] text-ink-600">
                    {job.location ? <span className="rounded-lg bg-slate-100 px-3 py-2">{job.location}</span> : null}
                    {salary ? <span className="rounded-lg bg-slate-100 px-3 py-2">{salary}</span> : null}
                  </div>
                </div>

                <Link
                  to={`/vagas/${job.slug}`}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-brand-700 px-5 text-sm font-black text-white shadow-lg shadow-slate-900/10 transition hover:bg-brand-600"
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
