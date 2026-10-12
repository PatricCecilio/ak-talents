import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { JobForm } from '../components/admin/JobForm'
import { MoveStageDialog } from '../components/recruiter/MoveStageDialog'
import { approveJob, getJobScreeningQuestions, hideJob, updateJobScreeningQuestions } from '../services/adminService'
import { getCurrentUser } from '../services/authService'
import { formatContractType, formatSalary, formatWorkMode } from '../services/jobFormat'
import { getJobPipeline } from '../services/pipelineService'
import type { AdminCompany } from '../types/user'
import type { ApplicationCard, JobPipelineResponse, StageValue } from '../types/pipeline'
import { AddCandidateDialog } from './AddCandidateDialog'
import { usePanel, usePanelActions } from './panelContext'
import { getPanelCompanies, getPanelJob } from './panelApi'
import {
  BOARD_COLUMNS,
  COLUMN_TITLES,
  EXIT_STAGES,
  PANEL_BASE,
  cardSubtitle,
  daysAgo,
  jobStatus,
  publicJobUrl,
  publishedFor,
  shortAge,
} from './panelFormat'
import { ActionsMenu, PanelCard, PanelDialog, PanelIcon, Pill, type MenuAction } from './PanelUi'
import { panelButton, panelFocus } from './panelStyles'
import { ReferDialog } from './ReferDialog'
import type { PanelJobDetail } from './types'

type Tab = 'candidatos' | 'detalhes' | 'triagem'

const VIEW_KEY = 'ak_panel_job_view'

function readView(): 'quadro' | 'lista' {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'lista' ? 'lista' : 'quadro'
  } catch {
    return 'quadro'
  }
}

// Page of one job: header, tabs Candidatos (board or list, only this job), Detalhes da vaga, Perguntas de triagem.
export function JobPage() {
  const { jobId } = useParams()
  const id = Number(jobId)
  const navigate = useNavigate()
  const { refreshCounts } = usePanel()
  const isAdmin = getCurrentUser()?.role === 'admin'
  const [job, setJob] = useState<PanelJobDetail | null>(null)
  const [pipeline, setPipeline] = useState<JobPipelineResponse | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState<Tab>('candidatos')
  const [view, setView] = useState<'quadro' | 'lista'>(readView)
  const [showExits, setShowExits] = useState(false)
  const [moving, setMoving] = useState<{ card: ApplicationCard; to?: StageValue } | null>(null)
  const [referring, setReferring] = useState<ApplicationCard | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [dragged, setDragged] = useState<ApplicationCard | null>(null)

  const load = useCallback(() => {
    Promise.all([getPanelJob(id), getJobPipeline(id)])
      .then(([detail, board]) => {
        setJob(detail)
        setPipeline(board)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Não foi possível carregar a vaga.'))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  usePanelActions(
    job ? (
      <>
        <button
          type="button"
          className={panelButton.outline}
          onClick={() => void navigator.clipboard?.writeText(publicJobUrl(job.slug)).then(() => setMessage('Link da vaga copiado.'))}
        >
          Copiar link da vaga
        </button>
        <button type="button" className={panelButton.navy} onClick={() => setAdding(true)}>
          + Adicionar candidato
        </button>
      </>
    ) : null,
    [job?.slug],
  )

  const cards = useMemo(() => pipeline?.applications ?? [], [pipeline])
  const exits = cards.filter((card) => (EXIT_STAGES as readonly string[]).includes(card.stage))
  const columns: readonly StageValue[] = showExits ? [...BOARD_COLUMNS, ...EXIT_STAGES] : BOARD_COLUMNS
  const visibleCards = showExits ? cards : cards.filter((card) => !(EXIT_STAGES as readonly string[]).includes(card.stage))
  const otherActive = (card: ApplicationCard) =>
    cards.filter((other) => other.id !== card.id && !['hired', 'rejected', 'withdrawn'].includes(other.stage)).length

  function cardActions(card: ApplicationCard): MenuAction[] {
    return [
      { label: 'Abrir candidatura', onSelect: () => navigate(`${PANEL_BASE}/candidaturas/${card.id}`) },
      ...(card.allowed_next_stages.length ? [{ label: 'Mover para…', onSelect: () => setMoving({ card }) }] : []),
      { label: 'Indicar para outra vaga', hint: 'Cria a candidatura em Nova na outra vaga; esta não muda.', onSelect: () => setReferring(card) },
    ]
  }

  function onDrop(stage: StageValue) {
    const card = dragged
    setDragged(null)
    if (!card || card.stage === stage) return
    if (!card.allowed_next_stages.some((option) => option.value === stage)) {
      setError(`Não dá para mover direto de "${COLUMN_TITLES[card.stage]}" para "${COLUMN_TITLES[stage]}".`)
      return
    }
    setError('')
    setMoving({ card, to: stage })
  }

  function headerActions(): MenuAction[] {
    if (!job) return []
    const list: MenuAction[] = []
    if (job.status === 'draft' || job.status === 'closed') list.push({ label: 'Publicar', onSelect: () => void run(() => approveJob(job.id), 'Vaga publicada no site.') })
    if (job.status === 'approved') list.push({ label: 'Encerrar', hint: 'Sai do site.', onSelect: () => void run(() => hideJob(job.id), 'Vaga encerrada.') })
    list.push({ label: 'Ver no site', onSelect: () => window.open(publicJobUrl(job.slug, window.location.origin), '_blank', 'noopener') })
    return list
  }

  async function run(action: () => Promise<unknown>, done: string) {
    setError('')
    try {
      await action()
      setMessage(done)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.')
    }
  }

  if (!job || !pipeline) {
    return error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : <p className="text-sm text-ink-600">Carregando…</p>
  }

  const status = jobStatus(job.status)
  const subtitle = [
    job.company_name,
    job.location,
    job.openings ? `${job.openings} ${job.openings === 1 ? 'vaga' : 'vagas'}` : null,
    job.published_at ? `publicada há ${publishedFor(job.published_at)}` : null,
    `recrutadora: ${job.recruiter_name?.split(' ')[0] ?? 'sem'}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex flex-col gap-3 xl:h-full xl:min-h-0">
      <nav aria-label="Caminho" className="text-sm text-ink-600">
        <Link to={`${PANEL_BASE}/vagas`} className={`font-semibold text-gold-800 hover:text-ink-950 ${panelFocus}`}>Vagas</Link> › {job.title}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 font-display text-2xl font-bold tracking-[-0.02em] text-ink-950 sm:text-[1.7rem]">
            {job.title} <Pill tone={status.tone}>{status.label}</Pill>
          </h1>
          <p className="mt-0.5 text-sm text-ink-600">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && job.status !== 'archived' ? (
            <button
              type="button"
              className={panelButton.outline}
              onClick={() => {
                if (!companies.length) getPanelCompanies().then(setCompanies).catch(() => setCompanies([]))
                setEditing(true)
              }}
            >
              Editar vaga
            </button>
          ) : null}
          {job.status !== 'archived' ? <ActionsMenu label="Mais ações da vaga" actions={headerActions()} /> : null}
        </div>
      </div>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e7e1d6]">
        <div role="tablist" aria-label="Seções da vaga" className="flex gap-5">
          {(
            [
              ['candidatos', 'Candidatos'],
              ['detalhes', 'Detalhes da vaga'],
              ['triagem', 'Perguntas de triagem'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`-mb-px border-b-2 pb-2.5 pt-1 text-[15px] font-semibold transition ${panelFocus} ${tab === value ? 'border-gold-600 text-ink-950' : 'border-transparent text-ink-600 hover:text-ink-950'}`}
            >
              {label}
              {value === 'candidatos' ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-ink-700">{cards.length}</span> : null}
            </button>
          ))}
        </div>
        {tab === 'candidatos' ? (
          <div className="flex flex-wrap items-center gap-3 pb-2 text-sm text-ink-600">
            {exits.length ? (
              <span>
                Reprovados e desistentes ({exits.length}) {showExits ? 'visíveis' : 'ocultos'} ·{' '}
                <button type="button" onClick={() => setShowExits((value) => !value)} className={`font-semibold text-gold-800 ${panelFocus}`}>
                  {showExits ? 'ocultar' : 'mostrar'}
                </button>
              </span>
            ) : null}
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-200" role="group" aria-label="Modo de exibição">
              {(['lista', 'quadro'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={view === mode}
                  onClick={() => {
                    setView(mode)
                    try {
                      window.localStorage.setItem(VIEW_KEY, mode)
                    } catch {
                      // Only a convenience.
                    }
                  }}
                  className={`px-4 py-2 text-sm font-semibold ${panelFocus} ${view === mode ? 'bg-ink-950 text-white' : 'bg-white text-ink-700'}`}
                >
                  {mode === 'lista' ? 'Lista' : 'Quadro'}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {tab === 'candidatos' && view === 'quadro' ? (
        <div className="flex gap-3 overflow-x-auto pb-2 xl:min-h-0 xl:flex-1" data-board>
          {columns.map((stage) => {
            const columnCards = visibleCards.filter((card) => card.stage === stage)
            const droppable = dragged ? dragged.allowed_next_stages.some((option) => option.value === stage) : false
            return (
              <section
                key={stage}
                aria-label={COLUMN_TITLES[stage]}
                onDragOver={(event) => {
                  // Every column accepts the drop, so a forbidden move can explain itself (and nothing moves).
                  if (dragged) event.preventDefault()
                }}
                onDrop={() => onDrop(stage)}
                className={`flex w-64 shrink-0 flex-col rounded-2xl bg-[#efe9df] p-2.5 transition xl:min-h-0 xl:w-auto xl:min-w-[11rem] xl:flex-1 xl:shrink ${droppable ? 'ring-2 ring-gold-400' : ''} ${dragged && !droppable && dragged.stage !== stage ? 'opacity-60' : ''}`}
              >
                <header className="flex items-center justify-between px-1.5 pb-2 pt-1">
                  <h3 className="truncate text-[13px] font-bold text-ink-950" title={COLUMN_TITLES[stage]}>{COLUMN_TITLES[stage]}</h3>
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-white px-1.5 text-xs font-bold text-ink-700">{columnCards.length}</span>
                </header>
                <div className="grid content-start gap-2 overflow-y-auto xl:min-h-0 xl:flex-1">
                  {columnCards.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-300 p-3 text-center text-xs text-ink-400">
                      {stage === 'client_approved' ? 'Arraste para cá quando o cliente aprovar' : 'Ninguém nesta etapa'}
                    </p>
                  ) : null}
                  {columnCards.map((card) => {
                    const late = card.waiting_client_too_long
                    return (
                      <article
                        key={card.id}
                        draggable={card.allowed_next_stages.length > 0}
                        onDragStart={() => setDragged(card)}
                        onDragEnd={() => setDragged(null)}
                        className={`rounded-xl border bg-white p-3 shadow-sm ${late ? 'border-l-4 border-gold-400' : 'border-slate-200'} ${card.allowed_next_stages.length ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      >
                        <Link to={`${PANEL_BASE}/candidaturas/${card.id}`} className={`block font-semibold text-ink-950 hover:text-gold-800 ${panelFocus}`}>
                          {card.candidate_name}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-600">{cardSubtitle(card.city, card.experience_years)}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className={`text-xs ${late ? 'font-semibold text-gold-800' : 'text-ink-600'}`}>
                            {late ? (
                              <span className="inline-flex items-center gap-1" title={`Com o cliente há ${daysAgo(card.stage_updated_at)} dias: cobrar retorno`}>
                                <PanelIcon name="alert" className="h-3.5 w-3.5 shrink-0" /> cobrar · {daysAgo(card.stage_updated_at)} dias
                              </span>
                            ) : (
                              shortAge(card.stage_updated_at)
                            )}
                          </span>
                          <ActionsMenu label={`Ações de ${card.candidate_name}`} actions={cardActions(card)} />
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      ) : null}

      {tab === 'candidatos' && view === 'lista' ? (
        <PanelCard className="xl:min-h-0 xl:flex-1">
          <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="sticky top-0 bg-[#faf8f4] text-xs font-semibold text-ink-600">
                <tr>
                  {['Candidato', 'Cidade e experiência', 'Etapa', 'Na etapa há', 'Ações'].map((label) => (
                    <th key={label} className="px-4 py-3 font-semibold first:pl-5">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleCards.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-ink-600">Nenhum candidato nesta vaga ainda.</td>
                  </tr>
                ) : null}
                {visibleCards.map((card) => (
                  <tr key={card.id} className={card.waiting_client_too_long ? 'bg-gold-50/60' : ''}>
                    <td className="px-4 py-3 pl-5 font-semibold text-ink-950">
                      <Link to={`${PANEL_BASE}/candidaturas/${card.id}`} className={panelFocus}>{card.candidate_name}</Link>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{cardSubtitle(card.city, card.experience_years)}</td>
                    <td className="px-4 py-3"><Pill>{COLUMN_TITLES[card.stage]}</Pill></td>
                    <td className="px-4 py-3 text-ink-700">
                      {card.waiting_client_too_long ? <span className="font-semibold text-gold-800">⚠ {daysAgo(card.stage_updated_at)} dias · cobrar retorno</span> : shortAge(card.stage_updated_at)}
                    </td>
                    <td className="px-4 py-3"><ActionsMenu label={`Ações de ${card.candidate_name}`} actions={cardActions(card)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelCard>
      ) : null}

      {tab === 'detalhes' ? <JobDetails job={job} /> : null}
      {tab === 'triagem' ? <ScreeningEditor jobId={job.id} /> : null}

      {moving ? (
        <MoveStageDialog
          applicationId={moving.card.id}
          candidateName={moving.card.candidate_name}
          currentLabel={moving.card.stage_label}
          currentStage={moving.card.stage}
          companyName={job.company_name}
          options={moving.card.allowed_next_stages}
          otherActiveCount={otherActive(moving.card)}
          openings={job.openings}
          initialStage={moving.to}
          onClose={() => setMoving(null)}
          onMoved={() => {
            setMoving(null)
            setMessage(`${moving.card.candidate_name} movido(a).`)
            load()
            refreshCounts()
          }}
        />
      ) : null}
      {referring ? (
        <ReferDialog
          card={referring}
          fromJobId={job.id}
          onClose={() => setReferring(null)}
          onDone={(title) => {
            setReferring(null)
            setMessage(`${referring.candidate_name} indicado(a) para ${title}.`)
            refreshCounts()
          }}
        />
      ) : null}
      {adding ? (
        <AddCandidateDialog
          jobId={job.id}
          jobTitle={job.title}
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false)
            setMessage('Candidato cadastrado na etapa Nova.')
            load()
            refreshCounts()
          }}
        />
      ) : null}
      {editing ? (
        <PanelDialog title="Editar vaga" onClose={() => setEditing(false)} wide>
          <JobForm
            jobId={job.id}
            companies={companies}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              setMessage('Vaga salva.')
              load()
            }}
          />
        </PanelDialog>
      ) : null}
    </div>
  )
}

function JobDetails({ job }: { job: PanelJobDetail }) {
  const rows: Array<[string, string]> = [
    ['Empresa', job.company_name],
    ['Cidade', job.location ?? '—'],
    ['Salário', formatSalary(job) || 'A combinar'],
    ['Contrato', formatContractType(job.contract_type) || '—'],
    ['Modelo', formatWorkMode(job.work_mode) || '—'],
    ['Horário ou escala', job.schedule ?? '—'],
    ['Quantidade de vagas', job.openings ? String(job.openings) : '—'],
    ['Benefícios', job.benefits ?? '—'],
  ]
  return (
    <PanelCard className="xl:min-h-0 xl:flex-1">
      <div className="grid gap-6 overflow-y-auto p-5 lg:grid-cols-[1fr_1.4fr]">
        <dl className="grid content-start gap-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">{label}</dt>
              <dd className="mt-0.5 whitespace-pre-line text-ink-950">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="grid content-start gap-4 text-sm">
          <section>
            <h3 className="font-display text-base font-bold text-ink-950">Descrição</h3>
            <p className="mt-1 whitespace-pre-line text-ink-800">{job.description}</p>
          </section>
          {job.requirements ? (
            <section>
              <h3 className="font-display text-base font-bold text-ink-950">Requisitos</h3>
              <p className="mt-1 whitespace-pre-line text-ink-800">{job.requirements}</p>
            </section>
          ) : null}
        </div>
      </div>
    </PanelCard>
  )
}

function ScreeningEditor({ jobId }: { jobId: number }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    getJobScreeningQuestions(jobId)
      .then((questions) =>
        setText(
          JSON.stringify(
            questions.map((question) => {
              const editable: Record<string, unknown> = { ...question }
              delete editable.id
              delete editable.job_id
              delete editable.created_at
              return editable
            }),
            null,
            2,
          ),
        ),
      )
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Não foi possível carregar as perguntas.'))
      .finally(() => setLoading(false))
  }, [jobId])

  async function save() {
    setError('')
    setMessage('')
    try {
      const parsed = JSON.parse(text || '[]') as unknown
      if (!Array.isArray(parsed)) throw new Error('A configuração precisa ser uma lista JSON de perguntas.')
      await updateJobScreeningQuestions(jobId, parsed)
      setMessage('Perguntas de triagem salvas.')
    } catch (err) {
      setError(err instanceof SyntaxError ? 'Confira o JSON: há um erro de formatação.' : err instanceof Error ? err.message : 'Não foi possível salvar.')
    }
  }

  return (
    <PanelCard className="xl:min-h-0 xl:flex-1">
      <div className="flex flex-col gap-3 p-5 xl:min-h-0 xl:flex-1">
        <p className="text-sm text-ink-700">Lista JSON de perguntas (YES_NO, SINGLE_SELECT ou TEXT). As respostas aparecem para a equipe na candidatura.</p>
        {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}
        {message ? <p role="status" className="text-sm font-semibold text-emerald-800">{message}</p> : null}
        <textarea
          aria-label="Perguntas de triagem (JSON)"
          value={loading ? 'Carregando…' : text}
          disabled={loading}
          onChange={(event) => setText(event.target.value)}
          rows={14}
          className="min-h-56 w-full flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 font-mono text-sm text-ink-950 outline-none focus:border-gold-600 focus:ring-4 focus:ring-gold-100"
        />
        <div>
          <button type="button" className={panelButton.navy} onClick={() => void save()} disabled={loading}>
            Salvar perguntas
          </button>
        </div>
      </div>
    </PanelCard>
  )
}
