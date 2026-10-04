import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyApplications } from '../../services/candidatePipelineService'
import { formatDaysAgo } from '../../services/pipelineFormat'
import type { CandidateApplicationView, CandidateApplicationsResponse } from '../../types/candidatePipeline'
import { BrandNotice } from '../brand/BrandNotice'
import { brandButtonVariants, brandCard, brandHeading } from '../brand/styles'

function Timeline({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Andamento da candidatura">
      {steps.map((label, index) => {
        const position = index + 1
        const done = position < current
        const active = position === current
        return (
          <li key={label} className="grid justify-items-center gap-1.5 text-center" aria-current={active ? 'step' : undefined}>
            <span
              className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${
                active ? 'bg-gold-700 text-white ring-4 ring-gold-100' : done ? 'bg-ink-950 text-white' : 'bg-slate-200 text-ink-600'
              }`}
            >
              {done ? '✓' : position}
            </span>
            <span className={`text-[11px] leading-tight sm:text-xs ${active ? 'font-semibold text-ink-950' : 'text-ink-600'}`}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function ApplicationItem({ item, steps }: { item: CandidateApplicationView; steps: string[] }) {
  const appliedOn = new Date(item.applied_at).toLocaleDateString('pt-BR')
  return (
    <li className={`${brandCard} grid gap-4 p-5`}>
      <div>
        <h3 className={`text-lg leading-snug ${brandHeading}`}>{item.job_title}</h3>
        <p className="mt-1 text-sm text-ink-600">
          {[item.company_name, item.job_location].filter(Boolean).join(' · ') || 'Vaga AK Talent'} · candidatura enviada em {appliedOn}
        </p>
      </div>

      {item.outcome === 'in_progress' && item.step ? (
        <>
          <Timeline steps={steps} current={item.step} />
          <p className="text-sm text-ink-700">
            Etapa atual: <strong>{item.status_label}</strong> · atualizado {formatDaysAgo(item.updated_at)}
          </p>
        </>
      ) : null}

      {item.outcome === 'hired' ? (
        <div className="rounded-lg bg-emerald-50 px-4 py-4 text-emerald-900">
          <p className="text-lg font-bold">🎉 {item.status_label}</p>
          <p className="mt-1 text-sm">A equipe AK Talent vai falar com você sobre os próximos passos.</p>
        </div>
      ) : null}

      {item.outcome === 'closed' ? (
        <div className="rounded-lg bg-slate-100 px-4 py-4 text-ink-700">
          <p className="font-semibold">{item.status_label}</p>
          <p className="mt-1 text-sm">Obrigado por participar. Continue de olho nas novas vagas, uma delas pode ser para você.</p>
        </div>
      ) : null}
    </li>
  )
}

/** Top of /candidate: the candidate's own applications with a simple, friendly status. */
export function MyApplicationsSection({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<CandidateApplicationsResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getMyApplications()
      .then((response) => {
        if (active) setData(response)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar suas candidaturas.')
      })
    return () => {
      active = false
    }
  }, [refreshKey])

  return (
    <section className="grid gap-4" aria-labelledby="my-applications-title">
      <h2 id="my-applications-title" className={`text-2xl ${brandHeading}`}>
        Minhas candidaturas
      </h2>

      {error ? <BrandNotice tone="error">{error}</BrandNotice> : null}
      {!data && !error ? <p className="text-sm text-ink-600">Carregando suas candidaturas...</p> : null}
      {data && data.applications.length === 0 ? (
        <div className={`${brandCard} grid gap-3 p-5`}>
          <p className="text-base text-ink-700">Você ainda não se candidatou a nenhuma vaga.</p>
          <Link to="/vagas" className={`${brandButtonVariants.primary} w-full sm:w-fit`}>
            Ver vagas abertas
          </Link>
        </div>
      ) : null}

      {data && data.applications.length ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {data.applications.map((item) => (
            <ApplicationItem key={item.id} item={item} steps={data.steps} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}
