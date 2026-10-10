import type { FormEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BrandButton } from '../../components/brand/BrandButton'
import { BrandNotice } from '../../components/brand/BrandNotice'
import { brandCard, brandHeading, brandInput } from '../../components/brand/styles'
import { MoveStageDialog } from '../../components/recruiter/MoveStageDialog'
import { StageBadge } from '../../components/recruiter/StageBadge'
import { moveResultNote } from '../../services/hireDefaults'
import { formatDateTime, formatDaysAgo, formatScreeningStatus, whatsappLink } from '../../services/pipelineFormat'
import { addApplicationNote, getApplicationDetail } from '../../services/pipelineService'
import type { ApplicationDetail } from '../../types/pipeline'

const ROLE_LABELS: Record<string, string> = {
  system: 'Sistema',
  admin: 'Admin',
  recruiter: 'Recrutador',
  company: 'Empresa cliente',
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${brandCard} grid gap-3 p-5`}>
      <h2 className={`text-lg ${brandHeading}`}>{title}</h2>
      {children}
    </section>
  )
}

export function RecruiterApplicationPage() {
  const { applicationId = '' } = useParams()
  const [detail, setDetail] = useState<ApplicationDetail | null>(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [isMoving, setIsMoving] = useState(false)
  const [flash, setFlash] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteError, setNoteError] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)

  useEffect(() => {
    let active = true
    getApplicationDetail(Number(applicationId))
      .then((response) => {
        if (active) setDetail(response)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar a candidatura.')
      })
    return () => {
      active = false
    }
  }, [applicationId, reloadKey])

  async function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!detail) return
    setNoteError('')
    setIsSavingNote(true)
    try {
      const note = await addApplicationNote(detail.id, noteText)
      setDetail({ ...detail, notes: [note, ...detail.notes] })
      setNoteText('')
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Não foi possível salvar a nota.')
    } finally {
      setIsSavingNote(false)
    }
  }

  if (error) return <BrandNotice tone="error">{error}</BrandNotice>
  if (!detail) return <p className="text-sm text-ink-600">Carregando candidatura...</p>

  const { candidate, screening } = detail
  const whatsapp = whatsappLink(candidate.phone)

  return (
    <div className="grid gap-5">
      <Link to={`/recrutador/vagas/${detail.job_id}`} className="w-fit text-sm font-semibold text-ink-700 hover:underline">
        ← {detail.job_title}
      </Link>

      <header className={`${brandCard} grid gap-4 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-ink-600">
              {detail.company_name} · {detail.job_title}
            </p>
            <h1 className={`mt-1 text-2xl ${brandHeading}`}>{candidate.name}</h1>
            <p className="mt-1 text-sm text-ink-600">
              Candidatura {formatDaysAgo(detail.created_at)} · na etapa atual {formatDaysAgo(detail.stage_updated_at)}
            </p>
          </div>
          <StageBadge stage={detail.stage} label={detail.stage_label} />
        </div>
        {detail.possible_duplicate ? (
          <BrandNotice tone="warning">
            <strong>Possível duplicado:</strong> outra candidatura desta vaga tem o mesmo telefone ou e-mail. Confira antes de
            seguir (nada foi bloqueado).
          </BrandNotice>
        ) : null}
        {flash ? <BrandNotice tone="success">{flash}</BrandNotice> : null}
        {detail.allowed_next_stages.length ? (
          <BrandButton variant="navy" fullWidth className="sm:w-auto" onClick={() => setIsMoving(true)}>
            Mover para…
          </BrandButton>
        ) : (
          <p className="text-sm text-ink-600">Esta candidatura está encerrada.</p>
        )}
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Contato">
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-ink-600">Telefone</dt>
              <dd className="font-semibold text-ink-950">{candidate.phone || 'Não informado'}</dd>
            </div>
            <div>
              <dt className="text-ink-600">E-mail</dt>
              <dd className="break-all font-semibold text-ink-950">{candidate.email || 'Não informado'}</dd>
            </div>
            <div>
              <dt className="text-ink-600">Cidade</dt>
              <dd className="font-semibold text-ink-950">{[candidate.city, candidate.neighborhood].filter(Boolean).join(' · ') || 'Não informada'}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {candidate.phone ? (
              <a href={`tel:${candidate.phone}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-ink-800">
                Ligar
              </a>
            ) : null}
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-ink-800">
                WhatsApp
              </a>
            ) : null}
            {candidate.email ? (
              <a href={`mailto:${candidate.email}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-ink-800">
                E-mail
              </a>
            ) : null}
          </div>
          {candidate.desired_role || candidate.experience_years !== null || candidate.skills ? (
            <p className="text-sm leading-6 text-ink-700">
              {candidate.desired_role ? <>Cargo desejado: {candidate.desired_role}<br /></> : null}
              {candidate.experience_years !== null ? <>Experiência: {candidate.experience_years} anos<br /></> : null}
              {candidate.skills ? <>Habilidades: {candidate.skills}</> : null}
            </p>
          ) : null}
          {!candidate.has_account ? <p className="text-xs text-ink-600">Candidatura feita pelo site, sem conta.</p> : null}
        </Section>

        <Section title="Triagem">
          <p className="text-sm font-semibold text-ink-950">
            {formatScreeningStatus(screening.status)}
            {screening.score !== null && (screening.status === 'QUALIFIED' || screening.status === 'NOT_MATCHED') ? ` · ${screening.score}% das regras atendidas` : ''}
          </p>
          {screening.summary ? <p className="text-sm text-ink-600">{screening.summary}</p> : null}
          {screening.answers.length ? (
            <dl className="grid gap-2 text-sm">
              {screening.answers.map((item) => (
                <div key={item.question} className="rounded-lg bg-slate-50 px-3 py-2">
                  <dt className="text-ink-600">{item.question}</dt>
                  <dd className="font-semibold text-ink-950">{item.answer || '—'}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-ink-600">Sem respostas de triagem.</p>
          )}
        </Section>
      </div>

      {detail.finalist_summary ? (
        <Section title="Parecer enviado à empresa">
          <p className="whitespace-pre-line text-sm leading-6 text-ink-800">{detail.finalist_summary}</p>
        </Section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Histórico">
          <ol className="grid gap-3">
            {[...detail.history].reverse().map((entry, index) => (
              <li key={`${entry.created_at}-${index}`} className="border-l-2 border-slate-200 pl-3 text-sm">
                <p className="font-semibold text-ink-950">
                  {entry.from_stage_label ? `${entry.from_stage_label} → ` : ''}
                  {entry.to_stage_label}
                </p>
                <p className="text-ink-600">
                  {formatDateTime(entry.created_at)} · {entry.changed_by_name ?? ROLE_LABELS[entry.changed_by_role] ?? entry.changed_by_role}
                  {entry.changed_by_name && entry.changed_by_role !== 'system' ? ` (${ROLE_LABELS[entry.changed_by_role] ?? entry.changed_by_role})` : ''}
                </p>
                {entry.note ? <p className="mt-1 text-ink-800">“{entry.note}”</p> : null}
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Notas internas">
          <p className="text-xs text-ink-600">Só a equipe AK Talent vê estas notas. A empresa e o candidato não têm acesso.</p>
          <form onSubmit={(event) => void handleAddNote(event)} className="grid gap-2">
            <label htmlFor="note" className="sr-only">
              Nova nota
            </label>
            <textarea
              id="note"
              className={`${brandInput} min-h-20 py-3`}
              placeholder="Ex.: Ligar amanhã às 10h para combinar a entrevista."
              value={noteText}
              maxLength={2000}
              onChange={(event) => setNoteText(event.target.value)}
            />
            {noteError ? <BrandNotice tone="error">{noteError}</BrandNotice> : null}
            <BrandButton type="submit" variant="secondary" isLoading={isSavingNote} className="sm:w-fit">
              Salvar nota
            </BrandButton>
          </form>
          <ul className="grid gap-2">
            {detail.notes.map((note) => (
              <li key={note.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <p className="whitespace-pre-line text-ink-900">{note.body}</p>
                <p className="mt-1 text-xs text-ink-600">
                  {note.author_name ?? 'Equipe AK'} · {formatDateTime(note.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {isMoving ? (
        <MoveStageDialog
          applicationId={detail.id}
          candidateName={candidate.name}
          currentLabel={detail.stage_label}
          currentStage={detail.stage}
          companyName={detail.company_name}
          options={detail.allowed_next_stages}
          otherActiveCount={detail.other_active_count}
          openings={detail.job_openings}
          onClose={() => setIsMoving(false)}
          onMoved={(response) => {
            setFlash(
              `Movido para "${response.stage_label}".` +
                moveResultNote(response.closed_others_count, response.job_closed),
            )
            setIsMoving(false)
            setReloadKey((key) => key + 1)
          }}
        />
      ) : null}
    </div>
  )
}
