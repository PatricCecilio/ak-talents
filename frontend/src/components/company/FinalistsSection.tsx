import { useEffect, useState } from 'react'
import { decideFinalist, getCompanyFinalists } from '../../services/companyPipelineService'
import { formatDaysAgo, whatsappLink } from '../../services/pipelineFormat'
import type { CompanyFinalist, CompanyFinalistsResponse } from '../../types/companyPipeline'
import { BrandButton } from '../brand/BrandButton'
import { BrandNotice } from '../brand/BrandNotice'
import { brandCard, brandHeading, brandInput } from '../brand/styles'

function FinalistCard({ finalist, onDecided }: { finalist: CompanyFinalist; onDecided: (updated: CompanyFinalist | null, message: string) => void }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')

  async function decide(decision: 'approve' | 'reject') {
    setBusy(decision)
    setError('')
    try {
      const updated = await decideFinalist(finalist.application_id, decision, decision === 'reject' ? reason : undefined)
      onDecided(
        decision === 'approve' ? updated : null,
        decision === 'approve'
          ? `${finalist.candidate_name} foi aprovado(a) para entrevista. O contato aparece em "Aprovados".`
          : `${finalist.candidate_name} foi recusado(a). A equipe AK Talent já foi avisada.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar sua decisão.')
      setBusy(null)
    }
  }

  return (
    <article className={`${brandCard} grid gap-4 p-5`}>
      <div>
        <p className="text-xs font-semibold text-ink-600">{finalist.job_title}</p>
        <h3 className={`mt-1 text-lg ${brandHeading}`}>{finalist.candidate_name}</h3>
        <p className="mt-1 text-sm text-ink-600">
          {[finalist.city, finalist.experience_years !== null ? `${finalist.experience_years} anos de experiência` : null].filter(Boolean).join(' · ') ||
            'Cidade não informada'}
          {' · '}enviado {formatDaysAgo(finalist.updated_at)}
        </p>
      </div>

      {finalist.finalist_summary ? (
        <blockquote className="rounded-lg border-l-4 border-gold-600 bg-gold-50 px-4 py-3 text-sm leading-6 text-ink-800">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-gold-800">Parecer da AK Talent</p>
          <p className="whitespace-pre-line">{finalist.finalist_summary}</p>
        </blockquote>
      ) : null}

      {error ? <BrandNotice tone="error">{error}</BrandNotice> : null}

      {rejecting ? (
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-semibold text-ink-800">
            Motivo da recusa (opcional)
            <textarea
              className={`${brandInput} min-h-20 py-3`}
              value={reason}
              maxLength={1000}
              placeholder="Ex.: Precisamos de alguém com experiência em caixa."
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <BrandButton variant="secondary" onClick={() => setRejecting(false)} disabled={busy !== null}>
              Voltar
            </BrandButton>
            <BrandButton variant="danger" isLoading={busy === 'reject'} onClick={() => void decide('reject')}>
              Confirmar recusa
            </BrandButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <BrandButton variant="primary" isLoading={busy === 'approve'} onClick={() => void decide('approve')}>
            Aprovar para entrevista
          </BrandButton>
          <BrandButton variant="secondary" disabled={busy !== null} onClick={() => setRejecting(true)}>
            Recusar
          </BrandButton>
        </div>
      )}
    </article>
  )
}

function ApprovedCard({ finalist }: { finalist: CompanyFinalist }) {
  const whatsapp = whatsappLink(finalist.phone)
  return (
    <li className="grid gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm">
      <p>
        <span className="font-semibold text-ink-950">{finalist.candidate_name}</span>
        <span className="text-ink-600"> · {finalist.job_title}</span>
      </p>
      <p className="text-ink-700">
        {finalist.phone ? `Telefone: ${finalist.phone}` : null}
        {finalist.phone && finalist.email ? ' · ' : null}
        {finalist.email ? `E-mail: ${finalist.email}` : null}
      </p>
      <div className="flex flex-wrap gap-2">
        {finalist.phone ? (
          <a href={`tel:${finalist.phone}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-ink-800">
            Ligar
          </a>
        ) : null}
        {whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-ink-800">
            WhatsApp
          </a>
        ) : null}
      </div>
    </li>
  )
}

/** Top of /company: finalists the AK Talent team sent for approval. Contact data only after approval. */
export function FinalistsSection() {
  const [data, setData] = useState<CompanyFinalistsResponse | null>(null)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')

  useEffect(() => {
    let active = true
    getCompanyFinalists()
      .then((response) => {
        if (active) setData(response)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar os finalistas.')
      })
    return () => {
      active = false
    }
  }, [])

  function handleDecided(applicationId: number, updated: CompanyFinalist | null, message: string) {
    setFlash(message)
    setData((current) =>
      current
        ? {
            pending: current.pending.filter((item) => item.application_id !== applicationId),
            approved: updated ? [updated, ...current.approved] : current.approved,
          }
        : current,
    )
  }

  const pendingCount = data?.pending.length ?? 0

  return (
    <section className="grid gap-4" aria-labelledby="finalists-title">
      <div className="flex items-center gap-3">
        <h2 id="finalists-title" className={`text-2xl ${brandHeading}`}>
          Finalistas para aprovar
        </h2>
        <span
          className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-sm font-bold ${pendingCount ? 'bg-gold-700 text-white' : 'bg-slate-200 text-ink-700'}`}
          aria-label={`${pendingCount} aguardando`}
        >
          {pendingCount}
        </span>
      </div>
      <p className="-mt-2 text-sm text-ink-600">A equipe AK Talent entrevistou e recomenda estes candidatos. Aprove quem você quer entrevistar.</p>

      {flash ? <BrandNotice tone="success">{flash}</BrandNotice> : null}
      {error ? <BrandNotice tone="error">{error}</BrandNotice> : null}
      {!data && !error ? <p className="text-sm text-ink-600">Carregando finalistas...</p> : null}
      {data && pendingCount === 0 ? <BrandNotice>Nenhum finalista aguardando sua decisão agora.</BrandNotice> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {data?.pending.map((finalist) => (
          <FinalistCard
            key={finalist.application_id}
            finalist={finalist}
            onDecided={(updated, message) => handleDecided(finalist.application_id, updated, message)}
          />
        ))}
      </div>

      {data && data.approved.length ? (
        <div className={`${brandCard} grid gap-3 p-5`}>
          <h3 className={`text-lg ${brandHeading}`}>Aprovados para entrevista</h3>
          <ul className="grid gap-2">
            {data.approved.map((finalist) => (
              <ApprovedCard key={finalist.application_id} finalist={finalist} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
