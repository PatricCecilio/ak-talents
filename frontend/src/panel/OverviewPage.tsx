import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCurrentUser } from '../services/authService'
import { AddCandidateDialog } from './AddCandidateDialog'
import { usePanelActions } from './panelContext'
import { getOverview } from './panelApi'
import { ACTIVITY_DOT, COLUMN_TITLES, PANEL_BASE, greeting, jobStatus, longDate, publishedFor, relativeTime } from './panelFormat'
import { CountBadge, PanelCard, PanelIcon, PanelPageHeader, Pill } from './PanelUi'
import { panelButton, panelFocus } from './panelStyles'
import type { OverviewResponse } from './types'

function StatCard({ title, value, detail, action, to, highlight }: { title: string; value: number; detail: string; action: string; to: string; highlight: boolean }) {
  return (
    <Link
      to={to}
      className={`group flex flex-col rounded-2xl border bg-white px-5 py-4 transition hover:-translate-y-0.5 hover:shadow-md ${panelFocus} ${
        highlight ? 'border-gold-300 border-l-4' : 'border-[#e7e1d6]'
      }`}
    >
      <span className="text-sm text-ink-700">{title}</span>
      <span className="mt-1 font-display text-4xl font-bold leading-none text-ink-950">{value}</span>
      <span className="mt-2 flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 truncate text-ink-600">{detail}</span>
        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-gold-800">
          {action} <PanelIcon name="arrow" className="h-4 w-4" />
        </span>
      </span>
    </Link>
  )
}

// Visão geral: what needs attention today. Recruiters see the numbers of their own jobs.
export function OverviewPage() {
  const navigate = useNavigate()
  const user = getCurrentUser()
  const isAdmin = user?.role === 'admin'
  const [data, setData] = useState<OverviewResponse | null>(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    getOverview()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Não foi possível carregar a visão geral.'))
  }, [])

  usePanelActions(
    <>
      <button type="button" className={panelButton.outline} onClick={() => setAdding(true)}>
        + Candidato
      </button>
      {isAdmin ? (
        <Link to={`${PANEL_BASE}/vagas?nova=1`} className={panelButton.navy}>
          + Nova vaga
        </Link>
      ) : null}
    </>,
    [isAdmin],
  )

  const firstName = (user?.name ?? '').split(' ')[0]
  const maxStage = Math.max(1, ...(data?.stage_counts.map((row) => row.count) ?? [1]))

  return (
    <div className="flex flex-col gap-4 xl:h-full xl:min-h-0">
      <PanelPageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle={`O que precisa da sua atenção hoje · ${longDate()}${data?.scope === 'mine' ? ' · suas vagas' : ''}`}
      />
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Novas para triar"
              value={data.cards.to_triage}
              detail={`${data.cards.to_triage_last_24h} ${data.cards.to_triage_last_24h === 1 ? 'chegou' : 'chegaram'} nas últimas 24h`}
              action="Triar"
              to={`${PANEL_BASE}/vagas?foco=triar`}
              highlight={data.cards.to_triage > 0}
            />
            <StatCard
              title="Aguardando o cliente"
              value={data.cards.waiting_client}
              detail={`${data.cards.waiting_client_too_long} há mais de ${data.alert_days} dias`}
              action="Cobrar"
              to={`${PANEL_BASE}/vagas?foco=cliente`}
              highlight={data.cards.waiting_client_too_long > 0}
            />
            <StatCard
              title="Vagas sem candidatos"
              value={data.cards.jobs_without_candidates}
              detail="Divulgar novamente"
              action="Ver"
              to={`${PANEL_BASE}/vagas?foco=sem-candidatos`}
              highlight={false}
            />
            <StatCard
              title="Contratações no mês"
              value={data.cards.hires_this_month}
              detail={`${data.cards.jobs_in_progress} ${data.cards.jobs_in_progress === 1 ? 'vaga' : 'vagas'} em andamento`}
              action="Ver"
              to={`${PANEL_BASE}/vagas?status=approved`}
              highlight={false}
            />
          </div>

          <div className="grid gap-3 xl:h-[min(17.5rem,36vh)] xl:grid-cols-[1.35fr_1fr_1.15fr]">
            <PanelCard title="Candidaturas por etapa" action={<span className="text-xs text-ink-600">{data.scope === 'mine' ? 'suas vagas' : 'todas as vagas'}</span>}>
              <ul className="grid content-start gap-2.5 overflow-y-auto px-5 pb-4 pt-1">
                {data.stage_counts.map((row) => (
                  <li key={row.stage} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-3 text-sm text-ink-950">
                    <span className="truncate">{COLUMN_TITLES[row.stage] ?? row.label}</span>
                    <span className="h-2.5 rounded-full bg-slate-100">
                      <span className="block h-2.5 rounded-full bg-ink-900" style={{ width: `${Math.max(row.count ? 8 : 0, (row.count / maxStage) * 100)}%` }} />
                    </span>
                    <span className="text-right font-semibold">{row.count}</span>
                  </li>
                ))}
              </ul>
            </PanelCard>

            <PanelCard title="Vagas" action={<Link to={`${PANEL_BASE}/vagas`} className={panelButton.link}>Ver todas <PanelIcon name="arrow" className="h-4 w-4" /></Link>}>
              <ul className="divide-y divide-slate-100 overflow-y-auto px-5 pb-3">
                {(
                  [
                    ['Publicadas', data.jobs_summary.approved, 'bg-emerald-50 text-emerald-800', 'approved'],
                    ['Rascunho', data.jobs_summary.draft, 'bg-slate-100 text-ink-700', 'draft'],
                    ['Encerradas', data.jobs_summary.closed, 'bg-gold-50 text-gold-800', 'closed'],
                    ['Arquivadas', data.jobs_summary.archived, 'bg-slate-100 text-ink-600', 'archived'],
                  ] as const
                ).map(([label, value, tone, status]) => (
                  <li key={label}>
                    <Link to={`${PANEL_BASE}/vagas?status=${status}`} className={`flex items-center justify-between py-2.5 text-sm text-ink-950 hover:text-gold-800 ${panelFocus}`}>
                      {label}
                      <CountBadge value={value} tone={tone} />
                    </Link>
                  </li>
                ))}
                <li className="flex items-center justify-between py-2.5 text-sm text-ink-950">
                  Empresas ativas <span className="font-semibold">{data.jobs_summary.active_companies}</span>
                </li>
              </ul>
            </PanelCard>

            <PanelCard title="Atividade recente">
              <ul className="grid gap-3 overflow-y-auto px-5 pb-4">
                {data.activity.length === 0 ? <li className="text-sm text-ink-600">Nada por aqui ainda.</li> : null}
                {data.activity.map((item, index) => (
                  <li key={`${item.kind}-${item.at}-${index}`}>
                    <button
                      type="button"
                      disabled={!item.job_id}
                      onClick={() => item.job_id && navigate(`${PANEL_BASE}/vagas/${item.job_id}`)}
                      className={`grid w-full grid-cols-[0.75rem_1fr_auto] items-start gap-2 text-left ${panelFocus}`}
                    >
                      <span className={`mt-1.5 h-2 w-2 rounded-full ${ACTIVITY_DOT[item.kind] ?? 'bg-slate-400'}`} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink-950">{item.title}</span>
                        <span className="block truncate text-xs text-ink-600">{item.detail}</span>
                      </span>
                      <span className="whitespace-nowrap text-xs text-ink-400">{relativeTime(item.at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </PanelCard>
          </div>

          <PanelCard
            title="Vagas em andamento"
            action={<Link to={`${PANEL_BASE}/vagas?status=approved`} className={panelButton.link}>Ver todas <PanelIcon name="arrow" className="h-4 w-4" /></Link>}
            className="xl:min-h-[10.5rem] xl:flex-1"
          >
            <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className="sticky top-0 bg-[#faf8f4] text-xs font-semibold text-ink-600">
                  <tr>
                    {['Vaga', 'Empresa', 'Candidaturas', 'Para triar', 'Com o cliente', 'Publicada há', 'Status'].map((label) => (
                      <th key={label} className="px-5 py-2.5 font-semibold">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.jobs_in_progress.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-6 text-center text-ink-600">Nenhuma vaga publicada agora.</td>
                    </tr>
                  ) : null}
                  {data.jobs_in_progress.map((job) => (
                    <tr key={job.id} className="cursor-pointer transition hover:bg-[#faf8f4]" onClick={() => navigate(`${PANEL_BASE}/vagas/${job.id}`)}>
                      <td className="px-5 py-3 font-semibold text-ink-950">
                        <Link to={`${PANEL_BASE}/vagas/${job.id}`} className={panelFocus} onClick={(event) => event.stopPropagation()}>
                          {job.title}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-ink-700">{job.company_name}</td>
                      <td className="px-5 py-3">{job.applications}</td>
                      <td className="px-5 py-3"><CountBadge value={job.to_triage} tone="bg-gold-50 text-gold-800" /></td>
                      <td className="px-5 py-3"><CountBadge value={job.with_client} tone="bg-blue-50 text-blue-700" /></td>
                      <td className="px-5 py-3 text-ink-700">{publishedFor(job.published_at)}</td>
                      <td className="px-5 py-3"><Pill tone={jobStatus(job.status).tone}>{jobStatus(job.status).label}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PanelCard>
        </>
      ) : !error ? (
        <p className="text-sm text-ink-600">Carregando…</p>
      ) : null}

      {adding ? <AddCandidateDialog onClose={() => setAdding(false)} onCreated={() => setAdding(false)} /> : null}
    </div>
  )
}
