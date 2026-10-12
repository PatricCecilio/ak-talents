import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getAdminJobs } from '../services/adminService'
import { getCurrentUser } from '../services/authService'
import type { AdminJob } from '../types/user'
import { AddCandidateDialog } from './AddCandidateDialog'
import { EditCandidateDialog, EraseCandidateDialog } from './CandidateDialogs'
import { usePanelActions } from './panelContext'
import { getCandidate, getCandidates } from './panelApi'
import { CANDIDATE_STAGE_FILTERS, PANEL_BASE, STAGE_TONES, initials, maskPhone } from './panelFormat'
import { ActionsMenu, PanelCard, PanelPageHeader, PanelSelect, Pagination, Pill, type MenuAction } from './PanelUi'
import { panelButton, panelFocus } from './panelStyles'
import { ReferDialog } from './ReferDialog'
import type { CandidateDetail, CandidateRow, CandidatesListResponse } from './types'

// Candidatos: AK's talent pool, with filters, pages of 10 and a "⋯" menu per person.
export function CandidatesPage() {
  const navigate = useNavigate()
  const isAdmin = getCurrentUser()?.role === 'admin'
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<CandidatesListResponse | null>(null)
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CandidateDetail | null>(null)
  const [referring, setReferring] = useState<{ applicationId: number; jobId: number; name: string } | null>(null)
  const [erasing, setErasing] = useState<CandidateRow | null>(null)

  const stage = params.get('etapa') ?? ''
  const jobId = params.get('vaga') ?? ''
  const city = params.get('cidade') ?? ''
  const page = Number(params.get('p') ?? '1') || 1

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'p') next.delete('p')
    setParams(next, { replace: true })
  }

  const load = useCallback(() => {
    getCandidates({ stage: stage || undefined, job_id: jobId ? Number(jobId) : undefined, city: city || undefined, page })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Não foi possível carregar os candidatos.'))
  }, [stage, jobId, city, page])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    getAdminJobs().then(setJobs).catch(() => setJobs([]))
  }, [])

  usePanelActions(
    <button type="button" className={panelButton.navy} onClick={() => setAdding(true)}>
      + Novo candidato
    </button>,
    [],
  )

  async function withDetail(candidateId: number, then: (detail: CandidateDetail) => void) {
    setError('')
    try {
      then(await getCandidate(candidateId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o candidato.')
    }
  }

  function actionsFor(row: CandidateRow): MenuAction[] {
    const list: MenuAction[] = [
      { label: 'Ver perfil e candidaturas', onSelect: () => navigate(`${PANEL_BASE}/candidatos/${row.id}`) },
      { label: 'Editar dados', onSelect: () => void withDetail(row.id, setEditing) },
    ]
    if (row.applications > 0) {
      list.push({
        label: 'Indicar para outra vaga',
        hint: 'Cria a candidatura em Nova na outra vaga; a atual não muda.',
        onSelect: () =>
          void withDetail(row.id, (detail) => {
            const latest = detail.applications[0]
            if (latest) setReferring({ applicationId: latest.id, jobId: latest.job_id, name: detail.name })
          }),
      })
    }
    if (isAdmin) {
      list.push({ label: 'Excluir dados (LGPD)', danger: true, hint: 'Apaga dados pessoais e currículo. Mantém só números anônimos.', onSelect: () => setErasing(row) })
    }
    return list
  }

  return (
    <div className="flex flex-col gap-3 fit:h-full fit:min-h-0">
      <PanelPageHeader title="Candidatos" subtitle={`Banco de talentos da AK${data ? ` · ${data.total} ${data.total === 1 ? 'pessoa' : 'pessoas'}` : ''}`} />

      <div className="flex flex-wrap items-center gap-2">
        <PanelSelect label="Etapa" value={stage} onChange={(value) => setParam('etapa', value)}>
          {CANDIDATE_STAGE_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </PanelSelect>
        <PanelSelect label="Vaga" value={jobId} onChange={(value) => setParam('vaga', value)}>
          <option value="">Todas as vagas</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>{job.title} · {job.company_name}</option>
          ))}
        </PanelSelect>
        <PanelSelect label="Cidade" value={city} onChange={(value) => setParam('cidade', value)}>
          <option value="">Todas as cidades</option>
          {(data?.cities ?? []).map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </PanelSelect>
      </div>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}

      <PanelCard className="fit:min-h-0 fit:flex-1">
        <div className="overflow-x-auto fit:min-h-0 fit:flex-1 fit:overflow-y-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#faf8f4] text-xs font-semibold text-ink-600">
              <tr>
                {['Nome', 'WhatsApp', 'Cidade', 'Etapa mais recente', 'Candidaturas', 'Ações'].map((label) => (
                  <th key={label} className="px-4 py-2.5 font-semibold first:pl-5">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data && data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink-600">Nenhum candidato com esses filtros.</td>
                </tr>
              ) : null}
              {data?.items.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2 pl-5">
                    <Link to={`${PANEL_BASE}/candidatos/${row.id}`} className={`flex items-center gap-3 ${panelFocus}`}>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-300 text-xs font-bold text-ink-950">{initials(row.name)}</span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink-950">{row.name}</span>
                        <span className="block truncate text-xs text-ink-600">{row.email ?? 'sem e-mail'}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-ink-700">{maskPhone(row.phone)}</td>
                  <td className="px-4 py-2 text-ink-700">{row.city ?? '—'}</td>
                  <td className="px-4 py-2"><Pill tone={row.latest_stage ? STAGE_TONES[row.latest_stage] : 'bg-slate-100 text-ink-600'}>{row.latest_stage_label}</Pill></td>
                  <td className="px-4 py-2">{row.applications}</td>
                  <td className="px-4 py-2"><ActionsMenu label={`Ações de ${row.name}`} actions={actionsFor(row)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data ? (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-ink-600">
            <span>
              {data.total === 0 ? 'Nenhum candidato' : `Mostrando ${(data.page - 1) * data.page_size + 1}–${Math.min(data.page * data.page_size, data.total)} de ${data.total}`}
            </span>
            <Pagination page={data.page} pageSize={data.page_size} total={data.total} onChange={(next) => setParam('p', String(next))} />
          </footer>
        ) : null}
      </PanelCard>

      {adding ? (
        <AddCandidateDialog
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            setAdding(false)
            navigate(`${PANEL_BASE}/candidatos/${id}`)
          }}
        />
      ) : null}
      {editing ? (
        <EditCandidateDialog
          candidate={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null)
            setMessage(`Dados de ${saved.name} salvos.`)
            load()
          }}
        />
      ) : null}
      {referring ? (
        <ReferDialog
          applicationId={referring.applicationId}
          candidateName={referring.name}
          fromJobId={referring.jobId}
          onClose={() => setReferring(null)}
          onDone={(title) => {
            setReferring(null)
            setMessage(`${referring.name} indicado(a) para ${title}.`)
            load()
          }}
        />
      ) : null}
      {erasing ? (
        <EraseCandidateDialog
          candidate={erasing}
          onClose={() => setErasing(null)}
          onErased={() => {
            setErasing(null)
            setMessage('Dados pessoais excluídos. A exclusão ficou registrada.')
            load()
          }}
        />
      ) : null}
    </div>
  )
}
