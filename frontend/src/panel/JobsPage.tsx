import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { JobForm } from '../components/admin/JobForm'
import { approveJob, deleteAdminJob, hideJob, setJobArchived } from '../services/adminService'
import { jobRemovalAction, deleteJobConfirmation } from '../services/adminForms'
import { getCurrentUser } from '../services/authService'
import { getTeam } from '../services/recruiterService'
import type { AdminCompany, StaffMember } from '../types/user'
import { usePanel, usePanelActions } from './panelContext'
import { assignResponsible, getPanelCompanies, getPanelJobs } from './panelApi'
import { JOB_STATUS_FILTERS, PANEL_BASE, jobStatus, publicJobUrl } from './panelFormat'
import { ActionsMenu, CountBadge, PanelCard, PanelDialog, PanelPageHeader, PanelSelect, Pagination, Pill, type MenuAction } from './PanelUi'
import { panelButton, panelFocus } from './panelStyles'
import type { JobsListFilters, JobsListResponse, PanelJobRow } from './types'

const FOCUS: Record<string, { api: JobsListFilters['focus']; label: string }> = {
  triar: { api: 'to_triage', label: 'Com candidaturas para triar' },
  cliente: { api: 'with_client', label: 'Com candidato aguardando o cliente' },
  'sem-candidatos': { api: 'empty', label: 'Publicadas sem candidatos' },
}

// Vagas: list first (click opens the job page). Recruiters start filtered on their own jobs.
export function JobsPage() {
  const navigate = useNavigate()
  const { refreshCounts } = usePanel()
  const user = getCurrentUser()
  const isAdmin = user?.role === 'admin'
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<JobsListResponse | null>(null)
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [team, setTeam] = useState<StaffMember[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<'new' | number | null>(params.get('nova') === '1' && isAdmin ? 'new' : null)
  const [assigning, setAssigning] = useState<PanelJobRow | null>(null)
  const [deleting, setDeleting] = useState<PanelJobRow | null>(null)

  const status = params.get('status') ?? ''
  const company = params.get('empresa') ?? ''
  // Only the admin filters by recruiter: a recruiter only ever gets their own jobs (the API enforces it).
  const recruiter = isAdmin ? (params.get('recrutadora') ?? '') : ''
  const archived = params.get('arquivadas') === '1'
  const focus = FOCUS[params.get('foco') ?? '']
  const page = Number(params.get('p') ?? '1') || 1

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'p') next.delete('p')
    next.delete('nova')
    setParams(next, { replace: true })
  }

  const load = useCallback(() => {
    const filters: JobsListFilters = {
      status: status || undefined,
      company_id: company ? Number(company) : undefined,
      mine: recruiter === 'minhas',
      no_recruiter: recruiter === 'sem',
      recruiter_id: /^\d+$/.test(recruiter) ? Number(recruiter) : undefined,
      include_archived: archived,
      focus: focus?.api,
      page,
    }
    getPanelJobs(filters)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Não foi possível carregar as vagas.'))
  }, [status, company, recruiter, archived, focus?.api, page])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    getPanelCompanies().then(setCompanies).catch(() => setCompanies([]))
    if (isAdmin) getTeam().then(setTeam).catch(() => setTeam([]))
  }, [isAdmin])

  usePanelActions(
    isAdmin ? (
      <button type="button" className={panelButton.navy} onClick={() => setEditing('new')}>
        + Nova vaga
      </button>
    ) : null,
    [isAdmin],
  )

  async function run(action: () => Promise<unknown>, done: string) {
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(done)
      load()
      refreshCounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.')
    }
  }

  function actionsFor(job: PanelJobRow): MenuAction[] {
    const list: MenuAction[] = [{ label: 'Abrir vaga', onSelect: () => navigate(`${PANEL_BASE}/vagas/${job.id}`) }]
    if (job.status === 'archived') {
      if (isAdmin) list.push({ label: 'Desarquivar', hint: 'Volta como Encerrada.', onSelect: () => void run(() => setJobArchived(job.id, false), 'Vaga desarquivada.') })
      return list
    }
    if (isAdmin) list.push({ label: 'Editar vaga', onSelect: () => setEditing(job.id) })
    if (job.status !== 'approved') list.push({ label: 'Publicar', onSelect: () => void run(() => approveJob(job.id), 'Vaga publicada no site.') })
    if (job.status === 'approved') list.push({ label: 'Encerrar', hint: 'Sai do site.', onSelect: () => void run(() => hideJob(job.id), 'Vaga encerrada.') })
    list.push({
      label: 'Copiar link da vaga',
      onSelect: () => void navigator.clipboard?.writeText(publicJobUrl(job.slug)).then(() => setMessage('Link da vaga copiado.')),
    })
    if (isAdmin) {
      list.push({ label: 'Trocar recrutadora', onSelect: () => setAssigning(job) })
      const removal = jobRemovalAction({ status: job.status, applications_count: job.applications })
      if (removal === 'delete') list.push({ label: 'Excluir', danger: true, hint: 'Só vagas sem candidaturas.', onSelect: () => setDeleting(job) })
      else list.push({ label: 'Arquivar', hint: 'Sai das listas e do site; o histórico fica.', onSelect: () => void run(() => setJobArchived(job.id, true), 'Vaga arquivada.') })
    }
    return list
  }

  const tableHeaders = ['Vaga', 'Empresa', 'Cidade', 'Recrutadora', 'Candidaturas', 'Para triar', 'Com o cliente', 'Status', 'Ações']

  return (
    <div className="flex flex-col gap-3 fit:h-full fit:min-h-0">
      <PanelPageHeader title="Vagas" subtitle="Clique em uma vaga para ver os candidatos" />

      <div className="flex flex-wrap items-center gap-2">
        <PanelSelect label="Status" value={status} onChange={(value) => setParam('status', value)}>
          {JOB_STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </PanelSelect>
        <PanelSelect label="Empresa" value={company} onChange={(value) => setParam('empresa', value)}>
          <option value="">Todas as empresas</option>
          {companies.map((item) => (
            <option key={item.id} value={item.id}>{item.company_name}</option>
          ))}
        </PanelSelect>
        {isAdmin ? (
          <PanelSelect label="Recrutadora" value={recruiter} onChange={(value) => setParam('recrutadora', value)}>
            <option value="">Recrutadora: todas</option>
            <option value="minhas">Minhas vagas</option>
            <option value="sem">Sem recrutadora</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </PanelSelect>
        ) : null}
        {focus ? (
          <button type="button" onClick={() => setParam('foco', '')} className={`inline-flex min-h-9 items-center gap-2 rounded-full bg-gold-50 px-3 text-sm font-semibold text-gold-800 ${panelFocus}`}>
            {focus.label} <span aria-hidden="true">×</span>
            <span className="sr-only">(remover filtro)</span>
          </button>
        ) : null}
        <button type="button" onClick={() => setParam('arquivadas', archived ? '' : '1')} className={`ml-auto ${panelButton.link}`}>
          {archived ? 'Ocultar arquivadas' : 'Mostrar arquivadas'}
        </button>
      </div>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}

      <PanelCard className="fit:min-h-0 fit:flex-1">
        <div className="overflow-x-auto fit:min-h-0 fit:flex-1 fit:overflow-y-auto">
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#faf8f4] text-xs font-semibold text-ink-600">
              <tr>
                {tableHeaders.map((label) => (
                  <th key={label} className="px-4 py-2.5 font-semibold first:pl-5">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data && data.items.length === 0 ? (
                <tr>
                  <td colSpan={tableHeaders.length} className="px-5 py-8 text-center text-ink-600">Nenhuma vaga com esses filtros.</td>
                </tr>
              ) : null}
              {data?.items.map((job) => (
                <tr key={job.id} className="cursor-pointer transition hover:bg-[#faf8f4]" onClick={() => navigate(`${PANEL_BASE}/vagas/${job.id}`)}>
                  <td className="px-4 py-2.5 pl-5 font-semibold text-ink-950">
                    <Link to={`${PANEL_BASE}/vagas/${job.id}`} className={panelFocus} onClick={(event) => event.stopPropagation()}>{job.title}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-ink-700">{job.company_name}</td>
                  <td className="px-4 py-2.5 text-ink-700">{job.location || '—'}</td>
                  <td className="px-4 py-2.5 text-ink-700">{job.recruiter_name?.split(' ')[0] ?? '—'}</td>
                  <td className="px-4 py-2.5">{job.applications}</td>
                  <td className="px-4 py-2.5"><CountBadge value={job.to_triage} tone="bg-gold-50 text-gold-800" /></td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <CountBadge value={job.with_client} tone="bg-blue-50 text-blue-700" />
                      {job.waiting_client_too_long ? <span title="Há candidato com o cliente há mais de 5 dias" className="text-xs font-semibold text-gold-800">⚠</span> : null}
                    </span>
                  </td>
                  <td className="px-4 py-2.5"><Pill tone={jobStatus(job.status).tone}>{jobStatus(job.status).label}</Pill></td>
                  <td className="px-4 py-2.5">
                    <ActionsMenu label={`Ações da vaga ${job.title}`} actions={actionsFor(job)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data ? (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-ink-600">
            <span>
              {data.total} {data.total === 1 ? 'vaga' : 'vagas'}
              {data.archived_hidden ? ` · ${data.archived_hidden} ${data.archived_hidden === 1 ? 'arquivada oculta' : 'arquivadas ocultas'}` : ''}
            </span>
            <Pagination page={data.page} pageSize={data.page_size} total={data.total} onChange={(next) => setParam('p', String(next))} />
          </footer>
        ) : null}
      </PanelCard>

      {editing !== null ? (
        <PanelDialog title={editing === 'new' ? 'Nova vaga' : 'Editar vaga'} onClose={() => setEditing(null)} wide>
          <JobForm
            jobId={editing === 'new' ? undefined : editing}
            companies={companies}
            onCancel={() => setEditing(null)}
            onSaved={(saved, created) => {
              setEditing(null)
              setMessage(created ? `Vaga ${saved.title} criada.` : `Vaga ${saved.title} salva.`)
              load()
            }}
          />
        </PanelDialog>
      ) : null}

      {assigning ? (
        <AssignDialog
          job={assigning}
          team={team}
          onClose={() => setAssigning(null)}
          onSave={(recruiterId) => {
            const job = assigning
            setAssigning(null)
            void run(() => assignResponsible(job.id, recruiterId), 'Recrutadora atualizada.')
          }}
        />
      ) : null}

      {deleting ? (
        <PanelDialog title="Excluir vaga" onClose={() => setDeleting(null)}>
          <p className="text-sm text-ink-700">{deleteJobConfirmation(deleting.title)}</p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={panelButton.outline} onClick={() => setDeleting(null)}>Cancelar</button>
            <button
              type="button"
              className={`${panelButton.navy} bg-red-700 hover:bg-red-800`}
              onClick={() => {
                const job = deleting
                setDeleting(null)
                void run(() => deleteAdminJob(job.id), `Vaga ${job.title} excluída.`)
              }}
            >
              Sim, excluir
            </button>
          </div>
        </PanelDialog>
      ) : null}
    </div>
  )
}

function AssignDialog({ job, team, onClose, onSave }: { job: PanelJobRow; team: StaffMember[]; onClose: () => void; onSave: (recruiterId: number | null) => void }) {
  const [value, setValue] = useState(job.recruiter_id ? String(job.recruiter_id) : '')
  return (
    <PanelDialog title={`Recrutadora de ${job.title}`} onClose={onClose}>
      <PanelSelect label="Recrutadora responsável" value={value} onChange={setValue}>
        <option value="">Sem recrutadora</option>
        {team.map((member) => (
          <option key={member.id} value={member.id}>{member.name}{member.role === 'admin' ? ' (admin)' : ''}</option>
        ))}
      </PanelSelect>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={panelButton.outline} onClick={onClose}>Cancelar</button>
        <button type="button" className={panelButton.navy} onClick={() => onSave(value ? Number(value) : null)}>Salvar</button>
      </div>
    </PanelDialog>
  )
}
