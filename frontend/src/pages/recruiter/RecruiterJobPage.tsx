import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BrandButton } from '../../components/brand/BrandButton'
import { BrandNotice } from '../../components/brand/BrandNotice'
import { BrandPageTitle } from '../../components/brand/BrandPageTitle'
import { brandCard } from '../../components/brand/styles'
import { MoveStageDialog } from '../../components/recruiter/MoveStageDialog'
import { StageBadge } from '../../components/recruiter/StageBadge'
import { moveResultNote } from '../../services/hireDefaults'
import { formatJobStatus } from '../../services/jobFormat'
import {
  CLOSED_STAGES,
  PIPELINE_COLUMNS,
  STAGE_SHORT_LABELS,
  finalistWaitingLabel,
  formatDaysAgo,
  formatScreeningStatus,
} from '../../services/pipelineFormat'
import { getJobPipeline } from '../../services/pipelineService'
import type { ApplicationCard, JobPipelineResponse, StageValue } from '../../types/pipeline'

type MobileFilter = 'active' | 'closed' | StageValue

const ACTIVE_STAGES: StageValue[] = ['new', 'screening', 'ak_interview', 'finalist', 'client_approved']

function DuplicateBadge() {
  return (
    <p
      className="w-fit rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800"
      title="Outra candidatura desta vaga tem o mesmo telefone ou e-mail."
    >
      Possível duplicado
    </p>
  )
}

function CandidateCard({
  card,
  onMove,
  showStage = true,
}: {
  card: ApplicationCard
  onMove: (card: ApplicationCard) => void
  showStage?: boolean
}) {
  // showStage=false means a narrow desktop board column: tighter card, stacked compact actions.
  const compact = !showStage
  return (
    <article className={`grid min-w-0 gap-3 rounded-lg border border-slate-200 bg-white ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start justify-between gap-2">
        <Link to={`/recrutador/candidaturas/${card.id}`} className="font-semibold leading-snug text-ink-950 hover:underline">
          {card.candidate_name}
        </Link>
        {showStage ? <StageBadge stage={card.stage} label={card.stage_label} /> : null}
      </div>
      {card.possible_duplicate ? <DuplicateBadge /> : null}
      <p className="text-sm text-ink-600">
        {[card.city, card.neighborhood].filter(Boolean).join(' · ') || 'Cidade não informada'}
        <br />
        Na etapa {formatDaysAgo(card.stage_updated_at)} · {formatScreeningStatus(card.screening_status)}
      </p>
      {card.stage === 'finalist' ? (
        <p
          className={`rounded-md px-3 py-2 text-xs font-semibold ${
            card.waiting_client_too_long ? 'bg-gold-100 text-gold-800' : 'bg-slate-100 text-ink-700'
          }`}
        >
          {finalistWaitingLabel(card.stage_updated_at)}
          {card.waiting_client_too_long ? ' · cobrar retorno' : ''}
        </p>
      ) : null}
      <div className={compact ? 'grid gap-1' : 'flex flex-wrap gap-2'}>
        {card.allowed_next_stages.length ? (
          compact ? (
            <button
              type="button"
              onClick={() => onMove(card)}
              className="min-h-10 w-full rounded-lg border border-ink-950/15 bg-white px-2 text-[13px] font-semibold text-ink-950 transition hover:border-ink-800/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-600"
            >
              Mover para…
            </button>
          ) : (
            <BrandButton variant="secondary" className="min-h-11 flex-1" onClick={() => onMove(card)}>
              Mover para…
            </BrandButton>
          )
        ) : null}
        <Link
          to={`/recrutador/candidaturas/${card.id}`}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold text-ink-700 hover:bg-slate-100"
        >
          Ver detalhes
        </Link>
      </div>
    </article>
  )
}

export function RecruiterJobPage() {
  const { jobId = '' } = useParams()
  const [data, setData] = useState<JobPipelineResponse | null>(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [filter, setFilter] = useState<MobileFilter>('active')
  const [moving, setMoving] = useState<ApplicationCard | null>(null)
  const [flash, setFlash] = useState('')

  useEffect(() => {
    let active = true
    getJobPipeline(Number(jobId))
      .then((response) => {
        if (active) setData(response)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar a vaga.')
      })
    return () => {
      active = false
    }
  }, [jobId, reloadKey])

  if (error) return <BrandNotice tone="error">{error}</BrandNotice>
  if (!data) return <p className="text-sm text-ink-600">Carregando candidatos...</p>

  const { job, applications } = data
  const byStage = (stage: StageValue) => applications.filter((card) => card.stage === stage)
  const closed = applications.filter((card) => CLOSED_STAGES.includes(card.stage))
  const filtered =
    filter === 'active'
      ? applications.filter((card) => ACTIVE_STAGES.includes(card.stage))
      : filter === 'closed'
        ? closed
        : byStage(filter)

  const mobileFilters: Array<{ value: MobileFilter; label: string; count: number }> = [
    { value: 'active', label: 'Ativos', count: job.active_count },
    ...PIPELINE_COLUMNS.map((stage) => ({ value: stage, label: STAGE_SHORT_LABELS[stage], count: job.stage_counts[stage] ?? 0 })),
    { value: 'closed', label: 'Encerrados', count: closed.length },
  ]

  const otherActiveFor = (card: ApplicationCard) => job.active_count - (ACTIVE_STAGES.includes(card.stage) ? 1 : 0)

  return (
    <div className="grid gap-5">
      <Link to="/recrutador" className="w-fit text-sm font-semibold text-ink-700 hover:underline">
        ← Todas as vagas
      </Link>
      <BrandPageTitle
        eyebrow={job.company_name}
        title={job.title}
        description={`${formatJobStatus(job.status)}${job.location ? ` · ${job.location}` : ''}${job.recruiter_name ? ` · Responsável: ${job.recruiter_name}` : ''}`}
      />

      {flash ? <BrandNotice tone="success">{flash}</BrandNotice> : null}
      {applications.length === 0 ? <BrandNotice>Nenhuma candidatura nesta vaga ainda.</BrandNotice> : null}

      {/* Phone and tablet: stage filter + list */}
      <div className="grid gap-4 lg:hidden">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Filtrar por etapa">
          {mobileFilters.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                filter === item.value ? 'border-ink-950 bg-ink-950 text-white' : 'border-slate-300 bg-white text-ink-700'
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>
        {filtered.length === 0 ? <p className="text-sm text-ink-600">Ninguém nesta etapa.</p> : null}
        {filtered.map((card) => (
          <CandidateCard key={card.id} card={card} onMove={setMoving} />
        ))}
      </div>

      {/* Desktop: one column per stage */}
      <div className="hidden lg:block">
        <div className="grid grid-flow-col auto-cols-[minmax(10.5rem,1fr)] gap-3 overflow-x-auto pb-2">
          {PIPELINE_COLUMNS.map((stage) => (
            <section key={stage} className={`${brandCard} grid min-w-0 content-start gap-3 bg-slate-50/80 p-3`} aria-label={STAGE_SHORT_LABELS[stage]}>
              <h2 className="flex items-center justify-between text-sm font-semibold text-ink-800">
                {STAGE_SHORT_LABELS[stage]}
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-ink-600">{job.stage_counts[stage] ?? 0}</span>
              </h2>
              {byStage(stage).map((card) => (
                <CandidateCard key={card.id} card={card} onMove={setMoving} showStage={false} />
              ))}
            </section>
          ))}
        </div>
        {closed.length ? (
          <details className={`${brandCard} mt-4 p-4`}>
            <summary className="cursor-pointer text-sm font-semibold text-ink-800">Encerrados ({closed.length})</summary>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {closed.map((card) => (
                <CandidateCard key={card.id} card={card} onMove={setMoving} />
              ))}
            </div>
          </details>
        ) : null}
      </div>

      {moving ? (
        <MoveStageDialog
          applicationId={moving.id}
          candidateName={moving.candidate_name}
          currentLabel={moving.stage_label}
          currentStage={moving.stage}
          companyName={job.company_name}
          options={moving.allowed_next_stages}
          otherActiveCount={otherActiveFor(moving)}
          openings={job.openings}
          onClose={() => setMoving(null)}
          onMoved={(response) => {
            setFlash(
              `${moving.candidate_name} foi para "${response.stage_label}".` +
                moveResultNote(response.closed_others_count, response.job_closed),
            )
            setMoving(null)
            setReloadKey((key) => key + 1)
          }}
        />
      ) : null}
    </div>
  )
}
