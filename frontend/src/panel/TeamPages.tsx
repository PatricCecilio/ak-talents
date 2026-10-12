import type { FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Input } from '../components/ui'
import { createRecruiter } from '../services/adminService'
import { getCurrentUser } from '../services/authService'
import { usePanelActions } from './panelContext'
import { getTeamMember, getTeamMembers, setTeamMemberActive, updateTeamMember } from './panelApi'
import { PANEL_BASE, initials, jobStatus, relativeTime } from './panelFormat'
import { ActionsMenu, CountBadge, PanelCard, PanelDialog, PanelPageHeader, Pill, type MenuAction } from './PanelUi'
import { panelButton, panelFocus } from './panelStyles'
import type { TeamMemberDetail, TeamMemberRow } from './types'

const ADMIN_ONLY = 'Só a administração vê a equipe.'

function lastActivity(iso: string | null): string {
  return iso ? relativeTime(iso).replace(/^há (\d+) h$/, 'hoje').replace(/^há \d+ min$|^agora$/, 'hoje') : 'sem atividade'
}

function memberActions(member: TeamMemberRow, selfId: number | undefined, onEdit: () => void, onToggle: () => void): MenuAction[] {
  const list: MenuAction[] = [{ label: 'Editar', onSelect: onEdit }]
  if (member.id !== selfId) list.push({ label: member.is_active ? 'Desativar' : 'Reativar', hint: member.is_active ? 'Deixa de entrar no sistema. Nada é apagado.' : undefined, onSelect: onToggle })
  return list
}

function EditMemberDialog({ member, onClose, onSaved }: { member: TeamMemberRow; onClose: () => void; onSaved: (row: TeamMemberRow) => void }) {
  const [name, setName] = useState(member.name)
  const [email, setEmail] = useState(member.email)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      onSaved(await updateTeamMember(member.id, { name: name.trim(), email: email.trim() }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PanelDialog title={`Editar ${member.name}`} onClose={onClose}>
      <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-4">
        {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}
        <Input id="member-name" label="Nome" value={name} onChange={(event) => setName(event.target.value)} />
        <Input id="member-email" label="E-mail de acesso" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={panelButton.outline} onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className={panelButton.navy} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </PanelDialog>
  )
}

function NewRecruiterDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string) => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const created = await createRecruiter(form)
      onCreated(created.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a recrutadora.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PanelDialog title="Nova recrutadora" onClose={onClose}>
      <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-4">
        {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}
        <Input id="new-name" label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Input id="new-email" label="E-mail de acesso" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <Input id="new-password" label="Senha inicial (mínimo 12 caracteres)" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        <p className="text-xs text-ink-600">Ela entra por /recrutamento. Envie o e-mail e a senha por um canal seguro.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={panelButton.outline} onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className={panelButton.navy} disabled={saving}>{saving ? 'Criando…' : 'Criar recrutadora'}</button>
        </div>
      </form>
    </PanelDialog>
  )
}

// Recrutadoras (Administração, admin only): the team with their numbers. Click opens the person's page.
export function TeamPage() {
  const navigate = useNavigate()
  const user = getCurrentUser()
  const isAdmin = user?.role === 'admin'
  const [members, setMembers] = useState<TeamMemberRow[] | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<TeamMemberRow | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    getTeamMembers()
      .then(setMembers)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Não foi possível carregar a equipe.'))
  }, [])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  usePanelActions(
    isAdmin ? (
      <button type="button" className={panelButton.navy} onClick={() => setCreating(true)}>
        + Nova recrutadora
      </button>
    ) : null,
    [isAdmin],
  )

  if (!isAdmin) return <p className="text-sm text-ink-600">{ADMIN_ONLY}</p>

  async function toggle(member: TeamMemberRow) {
    setError('')
    try {
      await setTeamMemberActive(member.id, !member.is_active)
      setMessage(member.is_active ? `${member.name} desativada (nada foi apagado).` : `${member.name} reativada.`)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.')
    }
  }

  return (
    <div className="flex flex-col gap-3 fit:h-full fit:min-h-0">
      <PanelPageHeader title="Recrutadoras" subtitle="Clique em uma pessoa para ver as vagas, o andamento e as anotações" />
      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      <PanelCard className="fit:min-h-0">
        <div className="overflow-x-auto fit:min-h-0 fit:overflow-y-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="sticky top-0 bg-[#faf8f4] text-xs font-semibold text-ink-600">
              <tr>
                {['Nome', 'Função', 'Vagas ativas', 'Candidatos em andamento', 'Contratações no mês', 'Última atividade', 'Status', 'Ações'].map((label) => (
                  <th key={label} className="px-4 py-2.5 font-semibold first:pl-5">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members?.map((member) => (
                <tr key={member.id} className="cursor-pointer hover:bg-[#faf8f4]" onClick={() => navigate(`${PANEL_BASE}/recrutadoras/${member.id}`)}>
                  <td className="px-4 py-2 pl-5">
                    <Link to={`${PANEL_BASE}/recrutadoras/${member.id}`} className={`flex items-center gap-3 ${panelFocus}`} onClick={(event) => event.stopPropagation()}>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-300 text-xs font-bold text-ink-950">{initials(member.name)}</span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink-950">{member.name}</span>
                        <span className="block truncate text-xs text-ink-600">{member.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-ink-700">{member.role_label}</td>
                  <td className="px-4 py-2">{member.active_jobs}</td>
                  <td className="px-4 py-2">{member.candidates_in_progress}</td>
                  <td className="px-4 py-2">{member.hires_this_month}</td>
                  <td className="px-4 py-2 text-ink-700">{lastActivity(member.last_activity_at)}</td>
                  <td className="px-4 py-2">{member.is_active ? <Pill tone="bg-emerald-50 text-emerald-800">Ativa</Pill> : <Pill tone="bg-slate-100 text-ink-600">Inativa</Pill>}</td>
                  <td className="px-4 py-2">
                    <ActionsMenu label={`Ações de ${member.name}`} actions={memberActions(member, user?.id, () => setEditing(member), () => void toggle(member))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>
      {editing ? (
        <EditMemberDialog
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={(row) => {
            setEditing(null)
            setMessage(`${row.name} atualizada.`)
            load()
          }}
        />
      ) : null}
      {creating ? (
        <NewRecruiterDialog
          onClose={() => setCreating(false)}
          onCreated={(name) => {
            setCreating(false)
            setMessage(`Recrutadora ${name} criada. Ela entra por /recrutamento.`)
            load()
          }}
        />
      ) : null}
    </div>
  )
}

const STAGE_COLUMNS: Array<[string, string, string]> = [
  ['new', 'Nova', 'bg-blue-50 text-blue-700'],
  ['screening', 'Triagem', 'bg-violet-50 text-violet-700'],
  ['ak_interview', 'Entrev.', 'bg-gold-50 text-gold-800'],
  ['finalist', 'Cliente', 'bg-blue-50 text-blue-700'],
  ['client_approved', 'Aprovou', 'bg-emerald-50 text-emerald-800'],
  ['hired', 'Contrat.', 'bg-emerald-50 text-emerald-800'],
]

function Stat({ title, value, detail, highlight = false }: { title: string; value: string | number; detail: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white px-5 py-4 ${highlight ? 'border-l-4 border-gold-300' : 'border-[#e7e1d6]'}`}>
      <p className="text-sm text-ink-700">{title}</p>
      <p className="mt-1 font-display text-4xl font-bold leading-none text-ink-950">{value}</p>
      <p className="mt-2 text-sm text-ink-600">{detail}</p>
    </div>
  )
}

// Page of one team member: their numbers, their jobs with counts per stage and their recent notes.
export function TeamMemberPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const user = getCurrentUser()
  const isAdmin = user?.role === 'admin'
  const [data, setData] = useState<TeamMemberDetail | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  const load = useCallback(() => {
    getTeamMember(Number(userId))
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Não foi possível carregar a pessoa.'))
  }, [userId])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  usePanelActions(
    isAdmin ? (
      <Link to={`${PANEL_BASE}/vagas?recrutadora=${userId}`} className={panelButton.outline}>
        Ver vagas dela
      </Link>
    ) : null,
    [isAdmin, userId],
  )

  if (!isAdmin) return <p className="text-sm text-ink-600">{ADMIN_ONLY}</p>
  if (!data) return error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : <p className="text-sm text-ink-600">Carregando…</p>

  const { member, cards } = data
  const firstName = member.name.split(' ')[0]
  const oldestTriage = cards.oldest_to_triage_at ? `a mais antiga há ${relativeTime(cards.oldest_to_triage_at).replace(/^há /, '')}` : 'ninguém esperando'
  const oldestClient = cards.oldest_with_client_at ? relativeTime(cards.oldest_with_client_at) : 'ninguém com o cliente'

  async function toggle() {
    setError('')
    try {
      await setTeamMemberActive(member.id, !member.is_active)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.')
    }
  }

  return (
    <div className="flex flex-col gap-3 fit:h-full fit:min-h-0">
      <nav aria-label="Caminho" className="text-sm text-ink-600">
        <Link to={`${PANEL_BASE}/recrutadoras`} className={`font-semibold text-gold-800 hover:text-ink-950 ${panelFocus}`}>Recrutadoras</Link> › {member.name}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-gold-300 font-display text-lg font-bold text-ink-950">{initials(member.name)}</span>
          <div>
            <h1 className="flex flex-wrap items-center gap-3 font-display text-2xl font-bold tracking-[-0.02em] text-ink-950">
              {member.name} {member.is_active ? <Pill tone="bg-emerald-50 text-emerald-800">Ativa</Pill> : <Pill tone="bg-slate-100 text-ink-600">Inativa</Pill>}
            </h1>
            <p className="text-sm text-ink-600">
              {member.role_label} · {member.email} · última atividade {member.last_activity_at ? relativeTime(member.last_activity_at) : 'nenhuma'}
            </p>
          </div>
        </div>
        <ActionsMenu label={`Ações de ${member.name}`} actions={memberActions(member, user?.id, () => setEditing(true), () => void toggle())} />
      </div>
      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Vagas ativas" value={cards.active_jobs} detail={`${cards.closed_this_month} ${cards.closed_this_month === 1 ? 'encerrada' : 'encerradas'} no mês`} />
        <Stat title="Para triar" value={cards.to_triage} detail={oldestTriage} highlight={cards.to_triage > 0} />
        <Stat title="Com o cliente" value={cards.with_client} detail={oldestClient} />
        <Stat
          title="Contratações no mês"
          value={cards.hires_this_month}
          detail={cards.average_days_to_hire !== null ? `média de ${String(cards.average_days_to_hire).replace('.', ',')} dias por vaga` : 'sem contratações no mês'}
        />
      </div>

      <div className="grid gap-3 fit:min-h-0 fit:flex-1 xl:grid-cols-[1.45fr_1fr]">
        <PanelCard title={`Vagas da ${firstName}`} action={<span className="text-xs text-ink-600">clique para abrir a vaga</span>} className="fit:min-h-0">
          <div className="overflow-x-auto fit:min-h-0 fit:flex-1 fit:overflow-y-auto">
            <table className="w-full min-w-[38rem] text-left text-sm">
              <thead className="sticky top-0 bg-[#faf8f4] text-xs font-semibold text-ink-600">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Vaga</th>
                  {STAGE_COLUMNS.map(([, label]) => (
                    <th key={label} className="px-2 py-2.5 text-center font-semibold">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-6 text-center text-ink-600">Nenhuma vaga com {firstName} como responsável.</td>
                  </tr>
                ) : null}
                {data.jobs.map((job) => (
                  <tr key={job.id} className="cursor-pointer hover:bg-[#faf8f4]" onClick={() => navigate(`${PANEL_BASE}/vagas/${job.id}`)}>
                    <td className="px-5 py-2.5">
                      <Link to={`${PANEL_BASE}/vagas/${job.id}`} className={`block font-semibold text-ink-950 ${panelFocus}`} onClick={(event) => event.stopPropagation()}>{job.title}</Link>
                      <span className="block text-xs text-ink-600">
                        {job.company_name} · {job.status === 'approved' && job.published_at ? `${relativeTime(job.published_at).replace(/^há /, '')}` : jobStatus(job.status).label}
                      </span>
                    </td>
                    {STAGE_COLUMNS.map(([stage, , tone]) => (
                      <td key={stage} className="px-2 py-2.5 text-center">
                        {job.stage_counts[stage] ? <CountBadge value={job.stage_counts[stage]} tone={tone} /> : <span className="text-ink-400">·</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelCard>

        <PanelCard title="Anotações recentes" className="fit:min-h-0">
          <ul className="grid gap-0 divide-y divide-slate-100 overflow-y-auto px-5 pb-4 fit:min-h-0">
            {data.notes.length === 0 ? <li className="py-3 text-sm text-ink-600">Nenhuma anotação ainda.</li> : null}
            {data.notes.map((note) => (
              <li key={note.id} className="py-3">
                <Link to={`${PANEL_BASE}/candidaturas/${note.application_id}`} className={`flex items-baseline justify-between gap-2 ${panelFocus}`}>
                  <span className="min-w-0 truncate text-sm">
                    <span className="font-semibold text-ink-950">{note.candidate_name}</span>
                    <span className="text-ink-600"> · {note.job_title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-400">{relativeTime(note.created_at)}</span>
                </Link>
                <span className="mt-1.5 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink-700">{note.kind_label}</span>
                <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-sm text-ink-800">{note.body}</p>
              </li>
            ))}
          </ul>
        </PanelCard>
      </div>

      {editing ? (
        <EditMemberDialog
          member={member}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            load()
          }}
        />
      ) : null}
    </div>
  )
}
