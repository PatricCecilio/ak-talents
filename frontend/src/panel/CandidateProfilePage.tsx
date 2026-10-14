import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatPhone } from '../services/adminForms'
import { getCurrentUser } from '../services/authService'
import { formatDateTime, whatsappLink } from '../services/pipelineFormat'
import { EditCandidateDialog, EraseCandidateDialog } from './CandidateDialogs'
import { getCandidate } from './panelApi'
import { PANEL_BASE, STAGE_TONES, cardSubtitle, initials, shortAge } from './panelFormat'
import { ActionsMenu, CandidateLinks, PanelCard, Pill, type MenuAction } from './PanelUi'
import { panelFocus } from './panelStyles'
import { ReferDialog } from './ReferDialog'
import type { CandidateDetail } from './types'

// "Ver perfil e candidaturas": contact, origin (and recorded authorization) and every application of the person.
export function CandidateProfilePage() {
  const { candidateId } = useParams()
  const navigate = useNavigate()
  const isAdmin = getCurrentUser()?.role === 'admin'
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(false)
  const [referring, setReferring] = useState(false)
  const [erasing, setErasing] = useState(false)

  const load = useCallback(() => {
    getCandidate(Number(candidateId))
      .then(setCandidate)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Não foi possível carregar o candidato.'))
  }, [candidateId])

  useEffect(() => {
    load()
  }, [load])

  if (!candidate) {
    return error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : <p className="text-sm text-ink-600">Carregando…</p>
  }

  const latest = candidate.applications[0]
  const actions: MenuAction[] = [
    { label: 'Editar dados', onSelect: () => setEditing(true) },
    ...(latest ? [{ label: 'Indicar para outra vaga', hint: 'A candidatura atual não muda.', onSelect: () => setReferring(true) }] : []),
    ...(isAdmin ? [{ label: 'Excluir dados (LGPD)', danger: true, hint: 'Não dá para desfazer.', onSelect: () => setErasing(true) }] : []),
  ]
  const whatsapp = whatsappLink(candidate.phone)
  const facts: Array<[string, ReactNode]> = [
    ['WhatsApp', whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={`font-semibold text-brand-700 hover:underline ${panelFocus}`}>{formatPhone(candidate.phone ?? '')}</a> : candidate.phone ?? '—'],
    ['E-mail', candidate.email ?? '—'],
    ['Cidade', [candidate.city, candidate.neighborhood].filter(Boolean).join(' · ') || '—'],
    ['Experiência', cardSubtitle(null, candidate.experience_years).replace('Cidade não informada', '—')],
    ['Cargo desejado', candidate.desired_role ?? '—'],
    ['Origem', candidate.source_label + (candidate.created_by_name ? ` · por ${candidate.created_by_name}` : '')],
  ]
  if (candidate.authorization_recorded_at) facts.push(['Autorização registrada', formatDateTime(candidate.authorization_recorded_at)])

  return (
    <div className="flex flex-col gap-3 fit:h-full fit:min-h-0">
      <nav aria-label="Caminho" className="text-sm text-ink-600">
        <Link to={`${PANEL_BASE}/candidatos`} className={`font-semibold text-gold-800 hover:text-ink-950 ${panelFocus}`}>Candidatos</Link> › {candidate.name}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-gold-300 font-display text-lg font-bold text-ink-950">{initials(candidate.name)}</span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink-950">
              {candidate.name}
              {candidate.is_active === false ? <span className="ml-2 align-middle rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink-600">Desativado</span> : null}
            </h1>
            <p className="text-sm text-ink-600">{candidate.has_account ? 'Tem conta no site' : 'Sem conta no site'} · no banco desde {new Date(candidate.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
        <ActionsMenu label="Ações do candidato" actions={actions} />
      </div>
      {message ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}

      <div className="grid gap-3 fit:min-h-0 fit:flex-1 xl:grid-cols-[1fr_1.6fr]">
        <PanelCard title="Dados">
          <dl className="grid gap-3 overflow-y-auto px-5 pb-5 text-sm">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">{label}</dt>
                <dd className="mt-0.5 break-words text-ink-950">{value}</dd>
              </div>
            ))}
            <CandidateLinks candidate={candidate} />
            {candidate.skills ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Habilidades</dt>
                <dd className="mt-0.5 whitespace-pre-line text-ink-950">{candidate.skills}</dd>
              </div>
            ) : null}
          </dl>
        </PanelCard>
        <PanelCard title={`Candidaturas (${candidate.applications.length})`} className="fit:min-h-0">
          <div className="overflow-x-auto fit:min-h-0 fit:flex-1 fit:overflow-y-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="sticky top-0 bg-[#faf8f4] text-xs font-semibold text-ink-600">
                <tr>
                  {['Vaga', 'Empresa', 'Etapa', 'Na etapa há'].map((label) => (
                    <th key={label} className="px-4 py-2.5 font-semibold first:pl-5">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidate.applications.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-ink-600">Ainda sem candidatura. Use “Indicar” a partir de outra vaga ou cadastre-o numa vaga.</td>
                  </tr>
                ) : null}
                {candidate.applications.map((application) => (
                  <tr key={application.id} className="cursor-pointer hover:bg-[#faf8f4]" onClick={() => navigate(`${PANEL_BASE}/candidaturas/${application.id}`)}>
                    <td className="px-4 py-2.5 pl-5 font-semibold text-ink-950">
                      <Link to={`${PANEL_BASE}/candidaturas/${application.id}`} className={panelFocus} onClick={(event) => event.stopPropagation()}>{application.job_title}</Link>
                      {application.is_hidden ? <span className="ml-2 text-xs text-ink-400">(oculta)</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-ink-700">{application.company_name}</td>
                    <td className="px-4 py-2.5"><Pill tone={STAGE_TONES[application.stage]}>{application.stage_label}</Pill></td>
                    <td className="px-4 py-2.5 text-ink-700">{shortAge(application.stage_updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelCard>
      </div>

      {editing ? (
        <EditCandidateDialog
          candidate={candidate}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false)
            setCandidate(saved)
            setMessage('Dados salvos.')
          }}
        />
      ) : null}
      {referring && latest ? (
        <ReferDialog
          applicationId={latest.id}
          candidateName={candidate.name}
          fromJobId={latest.job_id}
          onClose={() => setReferring(false)}
          onDone={(title) => {
            setReferring(false)
            setMessage(`Indicado(a) para ${title}.`)
            load()
          }}
        />
      ) : null}
      {erasing ? (
        <EraseCandidateDialog candidate={candidate} onClose={() => setErasing(false)} onErased={() => navigate(`${PANEL_BASE}/candidatos`)} />
      ) : null}
    </div>
  )
}
