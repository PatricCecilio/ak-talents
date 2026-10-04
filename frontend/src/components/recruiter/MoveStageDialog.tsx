import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { moveApplication } from '../../services/pipelineService'
import type { StageMoveResponse, StageOption, StageValue } from '../../types/pipeline'
import { BrandButton } from '../brand/BrandButton'
import { BrandNotice } from '../brand/BrandNotice'
import { brandHeading, brandInput, brandLabel } from '../brand/styles'

interface MoveStageDialogProps {
  applicationId: number
  candidateName: string
  currentLabel: string
  options: StageOption[]
  /** Other active candidates of the same job; offered to close as "Vaga preenchida" when hiring. */
  otherActiveCount: number
  onMoved: (response: StageMoveResponse) => void
  onClose: () => void
}

// "Mover para…" sheet: bottom sheet on phones, centered dialog on larger screens.
export function MoveStageDialog({
  applicationId,
  candidateName,
  currentLabel,
  options,
  otherActiveCount,
  onMoved,
  onClose,
}: MoveStageDialogProps) {
  const [toStage, setToStage] = useState<StageValue | ''>('')
  const [note, setNote] = useState('')
  const [finalistSummary, setFinalistSummary] = useState('')
  const [closeOthers, setCloseOthers] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panelRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const isFinalist = toStage === 'finalist'
  const canCloseOthers = toStage === 'hired' && otherActiveCount > 0

  async function submit() {
    if (!toStage) return
    setIsSaving(true)
    setError('')
    try {
      const response = await moveApplication(applicationId, {
        to_stage: toStage,
        note: note.trim() || undefined,
        finalist_summary: isFinalist ? finalistSummary : undefined,
        close_other_active: canCloseOthers && closeOthers ? true : undefined,
      })
      onMoved(response)
    } catch (err) {
      setConfirming(false)
      setError(err instanceof Error ? err.message : 'Não foi possível mover a candidatura.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!toStage) {
      setError('Escolha para qual etapa mover.')
      return
    }
    if (isFinalist && !finalistSummary.trim()) {
      setError('Escreva um parecer curto para a empresa antes de enviar o finalista.')
      return
    }
    if (canCloseOthers && closeOthers && !confirming) {
      setConfirming(true)
      return
    }
    void submit()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-stage-title"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92svh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6"
      >
        <h2 id="move-stage-title" className={`text-xl ${brandHeading}`}>
          Mover {candidateName}
        </h2>
        <p className="mt-1 text-sm text-ink-600">Etapa atual: {currentLabel}</p>

        {confirming ? (
          <div className="mt-5 grid gap-4">
            <BrandNotice tone="warning">
              Confirme: além de marcar {candidateName} como contratado, os outros{' '}
              <strong>{otherActiveCount}</strong> candidatos ativos desta vaga vão para <strong>Reprovado</strong> com a observação
              “Vaga preenchida”. Cada um terá esse registro no histórico.
            </BrandNotice>
            {error ? <BrandNotice tone="error">{error}</BrandNotice> : null}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <BrandButton variant="secondary" onClick={() => setConfirming(false)} disabled={isSaving}>
                Voltar
              </BrandButton>
              <BrandButton variant="primary" isLoading={isSaving} onClick={() => void submit()}>
                Sim, mover todos
              </BrandButton>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-semibold text-ink-800">Mover para</legend>
              {options.map((option) => (
                <label
                  key={option.value}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-base transition ${
                    toStage === option.value ? 'border-gold-600 bg-gold-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="to_stage"
                    value={option.value}
                    checked={toStage === option.value}
                    onChange={() => setToStage(option.value)}
                    className="h-4 w-4"
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>

            {isFinalist ? (
              <label className={brandLabel}>
                Parecer para a empresa (obrigatório)
                <span className="text-xs font-normal text-ink-600">A empresa cliente vai ler este texto. Seja breve e objetivo.</span>
                <textarea
                  className={`${brandInput} min-h-28 py-3`}
                  value={finalistSummary}
                  maxLength={2000}
                  onChange={(event) => setFinalistSummary(event.target.value)}
                />
              </label>
            ) : null}

            {canCloseOthers ? (
              <label className="flex gap-3 rounded-lg border border-slate-200 p-4 text-sm leading-6 text-ink-700">
                <input type="checkbox" checked={closeOthers} onChange={(event) => setCloseOthers(event.target.checked)} className="mt-1 h-4 w-4" />
                <span>
                  Mover também os outros <strong>{otherActiveCount}</strong> candidatos ativos desta vaga para “Reprovado”, com a
                  observação “Vaga preenchida”.
                </span>
              </label>
            ) : null}

            <label className={brandLabel}>
              Observação (opcional, só a equipe AK vê)
              <textarea className={`${brandInput} min-h-20 py-3`} value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} />
            </label>

            {error ? <BrandNotice tone="error">{error}</BrandNotice> : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <BrandButton variant="secondary" onClick={onClose}>
                Cancelar
              </BrandButton>
              <BrandButton type="submit" variant="navy" isLoading={isSaving}>
                Mover
              </BrandButton>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
