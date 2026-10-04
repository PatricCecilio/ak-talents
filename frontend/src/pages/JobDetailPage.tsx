import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Badge, Button, Card, LoadingSpinner, PageHeader } from '../components/ui'
import { Container } from '../components/Container'
import { LoadErrorState } from '../components/LoadErrorState'
import { ApiError } from '../services/api'
import { formatSalary, formatWorkMode } from '../services/jobFormat'
import { getJobBySlug } from '../services/jobService'
import { createPublicApplication, getPublicScreening, submitScreeningAnswers } from '../services/applicationService'
import { openAppIntelliOptions, toRecruitmentScreeningOpenOptions } from '../services/appIntelliWidget'
import {
  toPublicApplicationPayload,
  validatePublicApplicationForm,
  type PublicApplicationFormValues,
} from '../services/publicApplicationForm'
import type { Job, PublicScreeningQuestion, ScreeningSubmitResponse } from '../types/user'

type JobLoadError = 'not-found' | 'network' | 'server' | null

export function JobDetailPage() {
  const { slug = '' } = useParams()
  const [job, setJob] = useState<Job | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loadError, setLoadError] = useState<JobLoadError>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [formError, setFormError] = useState('')
  const [screeningError, setScreeningError] = useState('')
  const [isSubmittingScreening, setIsSubmittingScreening] = useState(false)
  const [success, setSuccess] = useState('')
  const [screeningToken, setScreeningToken] = useState('')
  const [applicationReference, setApplicationReference] = useState('')
  const [widgetStatus, setWidgetStatus] = useState<'idle' | 'opened' | 'waiting' | 'unavailable'>('idle')
  const [isLoadingLegacyScreening, setIsLoadingLegacyScreening] = useState(false)
  const [screeningQuestions, setScreeningQuestions] = useState<PublicScreeningQuestion[]>([])
  const [screeningAnswers, setScreeningAnswers] = useState<Record<number, boolean | string>>({})
  const [screeningResult, setScreeningResult] = useState<ScreeningSubmitResponse | null>(null)
  const [formValues, setFormValues] = useState<PublicApplicationFormValues>({
    full_name: '',
    email: '',
    phone: '',
    city: '',
    neighborhood: '',
    privacy_accepted: false,
  })

  function updateField<Key extends keyof PublicApplicationFormValues>(field: Key, value: PublicApplicationFormValues[Key]) {
    setFormValues((currentValues) => ({ ...currentValues, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || applicationReference) return
    setFormError('')
    setSuccess('')

    const validation = validatePublicApplicationForm(formValues)
    if (!validation.isValid) {
      setFormError(validation.message)
      return
    }

    setIsSubmitting(true)
    try {
      const response = await createPublicApplication(slug, toPublicApplicationPayload(formValues))
      setScreeningToken(response.public_screening_token)
      setApplicationReference(response.application_reference)
      setSuccess('Candidatura recebida com sucesso. Agora vamos iniciar sua triagem.')
      setShowForm(false)
      window.setTimeout(() => {
        openScreeningWidget(response.application_reference)
      }, 500)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível enviar sua candidatura.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function openScreeningWidget(reference: string) {
    if (!reference) return
    const result = openAppIntelliOptions(toRecruitmentScreeningOpenOptions(reference))
    setWidgetStatus(result)
  }

  async function handleLegacyScreeningStart() {
    if (!screeningToken || isLoadingLegacyScreening) return

    setIsLoadingLegacyScreening(true)
    setScreeningError('')
    try {
      const screening = await getPublicScreening(screeningToken)
      setScreeningQuestions(screening.questions)
    } catch (err) {
      setScreeningError(err instanceof Error ? err.message : 'Não foi possível carregar a triagem.')
    } finally {
      setIsLoadingLegacyScreening(false)
    }
  }

  function updateScreeningAnswer(questionId: number, value: boolean | string) {
    setScreeningAnswers((currentAnswers) => ({ ...currentAnswers, [questionId]: value }))
  }

  function isMissingScreeningAnswer(question: PublicScreeningQuestion) {
    const value = screeningAnswers[question.id]
    if (question.question_type === 'YES_NO') return typeof value !== 'boolean'
    return typeof value !== 'string' || value.trim() === ''
  }

  async function handleScreeningSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!screeningToken) return

    const missingRequired = screeningQuestions.find((question) => question.required && isMissingScreeningAnswer(question))
    if (missingRequired) {
      setScreeningError('Responda todas as perguntas obrigatórias da triagem.')
      return
    }

    setIsSubmittingScreening(true)
    setScreeningError('')

    try {
      const response = await submitScreeningAnswers(screeningToken, {
        answers: screeningQuestions
          .filter((question) => !isMissingScreeningAnswer(question))
          .map((question) => ({
            question_id: question.id,
            value: screeningAnswers[question.id],
          })),
      })
      setScreeningResult(response)
    } catch (err) {
      setScreeningError(err instanceof Error ? err.message : 'Não foi possível enviar a triagem.')
    } finally {
      setIsSubmittingScreening(false)
    }
  }

  function retryLoadJob() {
    setIsLoading(true)
    setLoadError(null)
    setReloadKey((key) => key + 1)
  }

  useEffect(() => {
    let active = true

    getJobBySlug(slug)
      .then((response) => {
        if (active) {
          setJob(response)
          setLoadError(null)
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setJob(null)
          if (err instanceof ApiError && err.isNotFound) setLoadError('not-found')
          else if (err instanceof ApiError && err.isNetworkError) setLoadError('network')
          else setLoadError('server')
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [slug, reloadKey])

  const salary = job ? formatSalary(job) : ''
  const workMode = job ? formatWorkMode(job.work_mode) : ''

  return (
    <Container className="py-12">
      <Link to="/vagas" className="text-sm font-black text-brand-700 transition hover:text-brand-600">
        Voltar para vagas
      </Link>

      {isLoading ? <Card className="mt-8 p-6"><LoadingSpinner label="Carregando vaga..." /></Card> : null}
      {!isLoading && loadError === 'not-found' ? (
        <div className="mt-8">
          <LoadErrorState
            title="Esta vaga não está mais disponível."
            description="Ela pode ter sido preenchida ou encerrada. Veja as outras oportunidades abertas."
            secondaryAction={{ to: '/vagas', label: 'Ver outras vagas' }}
          />
        </div>
      ) : null}
      {!isLoading && (loadError === 'network' || loadError === 'server') ? (
        <div className="mt-8">
          <LoadErrorState
            title="Não conseguimos abrir esta vaga."
            description={
              loadError === 'network'
                ? 'Confira sua conexão com a internet e toque em "Tentar novamente".'
                : 'Pode ser uma instabilidade rápida. Toque em "Tentar novamente" em alguns instantes.'
            }
            onRetry={retryLoadJob}
            secondaryAction={{ to: '/vagas', label: 'Ver outras vagas' }}
          />
        </div>
      ) : null}

      {job ? (
        <div className="mt-8 grid gap-8">
          <PageHeader
            eyebrow="Detalhes da vaga"
            title={job.title}
            description={job.location || 'Localização não informada'}
          />

          <Card className="p-6">
            <div className="flex flex-wrap gap-2">
              {workMode ? <Badge>{workMode}</Badge> : null}
              {salary ? <Badge>{salary}</Badge> : null}
            </div>

            <section className="mt-8">
              <h2 className="text-xl font-black text-ink-950">Descrição</h2>
              <p className="mt-3 whitespace-pre-line text-base leading-8 text-ink-700">{job.description}</p>
            </section>

            {job.requirements ? (
              <section className="mt-8">
                <h2 className="text-xl font-black text-ink-950">Requisitos</h2>
                <p className="mt-3 whitespace-pre-line text-base leading-8 text-ink-700">{job.requirements}</p>
              </section>
            ) : null}

            {success ? <div className="mt-8"><Alert tone="success">{success}</Alert></div> : null}

            {applicationReference ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => openScreeningWidget(applicationReference)}
                >
                  Continuar triagem
                </Button>
                {widgetStatus === 'unavailable' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    isLoading={isLoadingLegacyScreening}
                    disabled={isLoadingLegacyScreening}
                    onClick={() => void handleLegacyScreeningStart()}
                  >
                    Responder triagem estruturada
                  </Button>
                ) : null}
              </div>
            ) : null}

            {screeningError && screeningQuestions.length === 0 ? (
              <div className="mt-6">
                <Alert tone="error">{screeningError}</Alert>
              </div>
            ) : null}

            {!screeningToken ? (
              <Button
                type="button"
                className="mt-8"
                onClick={() => setShowForm((currentValue) => !currentValue)}
              >
                Candidatar-se
              </Button>
            ) : null}

            {showForm ? (
              <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 grid gap-5 border-t border-slate-200 pt-8">
                <div>
                  <h2 className="text-xl font-black text-ink-950">Enviar candidatura</h2>
                  <p className="mt-2 text-sm leading-6 text-ink-600">
                    Preencha seus dados principais para participar deste processo seletivo.
                  </p>
                </div>

                {formError ? <Alert tone="error">{formError}</Alert> : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <label htmlFor="application_full_name" className="grid gap-2 text-sm font-bold text-ink-800">
                    Nome completo
                    <input
                      id="application_full_name"
                      value={formValues.full_name}
                      onChange={(event) => updateField('full_name', event.target.value)}
                      className="h-12 rounded-lg border border-slate-300 bg-white px-4 text-base font-medium text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-gold-500 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>
                  <label htmlFor="application_email" className="grid gap-2 text-sm font-bold text-ink-800">
                    E-mail
                    <input
                      id="application_email"
                      type="email"
                      value={formValues.email}
                      onChange={(event) => updateField('email', event.target.value)}
                      className="h-12 rounded-lg border border-slate-300 bg-white px-4 text-base font-medium text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-gold-500 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label htmlFor="application_phone" className="grid gap-2 text-sm font-bold text-ink-800">
                    WhatsApp/telefone
                    <input
                      id="application_phone"
                      value={formValues.phone}
                      onChange={(event) => updateField('phone', event.target.value)}
                      className="h-12 rounded-lg border border-slate-300 bg-white px-4 text-base font-medium text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-gold-500 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>
                  <label htmlFor="application_city" className="grid gap-2 text-sm font-bold text-ink-800">
                    Cidade
                    <input
                      id="application_city"
                      value={formValues.city}
                      onChange={(event) => updateField('city', event.target.value)}
                      className="h-12 rounded-lg border border-slate-300 bg-white px-4 text-base font-medium text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-gold-500 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>
                  <label htmlFor="application_neighborhood" className="grid gap-2 text-sm font-bold text-ink-800">
                    Bairro
                    <input
                      id="application_neighborhood"
                      value={formValues.neighborhood}
                      onChange={(event) => updateField('neighborhood', event.target.value)}
                      className="h-12 rounded-lg border border-slate-300 bg-white px-4 text-base font-medium text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-gold-500 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>
                </div>

                <label htmlFor="application_privacy" className="flex gap-3 text-sm font-semibold leading-6 text-ink-700">
                  <input
                    id="application_privacy"
                    type="checkbox"
                    checked={formValues.privacy_accepted}
                    onChange={(event) => updateField('privacy_accepted', event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-gold-500"
                  />
                  <span>
                    Li e concordo com o tratamento dos meus dados pela AK Talent para participação neste processo seletivo.
                  </span>
                </label>

                <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
                  Enviar candidatura
                </Button>
              </form>
            ) : null}

            {screeningToken && screeningQuestions.length > 0 && !screeningResult ? (
              <form onSubmit={(event) => void handleScreeningSubmit(event)} className="mt-8 grid gap-5 border-t border-slate-200 pt-8">
                <div>
                  <h2 className="text-xl font-black text-ink-950">Triagem</h2>
                  <p className="mt-2 text-sm leading-6 text-ink-600">
                    Responda as perguntas iniciais para seguirmos com sua candidatura.
                  </p>
                </div>

                {screeningError ? <Alert tone="error">{screeningError}</Alert> : null}

                {screeningQuestions.map((question) => (
                  <div key={question.id} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-black text-ink-950">
                      {question.label}
                      {question.required ? <span className="text-red-600"> *</span> : null}
                    </p>

                    {question.question_type === 'YES_NO' ? (
                      <div className="flex flex-wrap gap-3">
                        {[
                          { value: true, label: 'Sim' },
                          { value: false, label: 'Não' },
                        ].map((option) => (
                          <label key={String(option.value)} className="flex items-center gap-2 text-sm font-semibold text-ink-700">
                            <input
                              type="radio"
                              name={`screening_${question.id}`}
                              checked={screeningAnswers[question.id] === option.value}
                              onChange={() => updateScreeningAnswer(question.id, option.value)}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    ) : null}

                    {question.question_type === 'SINGLE_SELECT' ? (
                      <select
                        value={String(screeningAnswers[question.id] ?? '')}
                        onChange={(event) => updateScreeningAnswer(question.id, event.target.value)}
                        className="h-12 rounded-lg border border-slate-300 bg-white px-4 text-base font-medium text-ink-950 outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-amber-100"
                      >
                        <option value="">Selecione</option>
                        {(question.options || []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : null}

                    {question.question_type === 'TEXT' ? (
                      <input
                        value={String(screeningAnswers[question.id] ?? '')}
                        onChange={(event) => updateScreeningAnswer(question.id, event.target.value)}
                        className="h-12 rounded-lg border border-slate-300 bg-white px-4 text-base font-medium text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-gold-500 focus:ring-4 focus:ring-amber-100"
                      />
                    ) : null}
                  </div>
                ))}

                <Button type="submit" isLoading={isSubmittingScreening} disabled={isSubmittingScreening}>
                  Enviar triagem
                </Button>
              </form>
            ) : null}

            {screeningResult ? (
              <div className="mt-8">
                <Alert tone="success">
                  Triagem recebida. Obrigado! A equipe da AK Talent vai analisar suas respostas e entrará em contato.
                </Alert>
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
    </Container>
  )
}
