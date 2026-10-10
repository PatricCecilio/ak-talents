import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Badge, Button, Card, PageHeader } from '../components/ui'
import { Container } from '../components/Container'
import { JobsLoading } from '../components/JobsLoading'
import { LoadErrorState } from '../components/LoadErrorState'
import { ApiError } from '../services/api'
import { formatSalary, formatWorkMode } from '../services/jobFormat'
import { PRIVACY_POLICY_PATH } from '../services/privacyPolicy'
import { getJobBySlug } from '../services/jobService'
import { createPublicApplication, getPublicScreening, submitScreeningAnswers } from '../services/applicationService'
import {
  APPLICATION_CONFIRMATION_MESSAGE,
  APPLICATION_CONFIRMATION_TITLE,
  MISSING_SCREENING_ANSWER_MESSAGE,
  firstMissingRequiredAnswer,
  stepAfterApplication,
  toScreeningAnswers,
  type ApplicationStep,
  type ScreeningAnswers,
} from '../services/applicationFlow'
import { openAppIntelliOptions, toRecruitmentScreeningOpenOptions } from '../services/appIntelliWidget'
import { SCREENING_CHAT_UNAVAILABLE_MESSAGE, isScreeningChatEnabled } from '../services/screeningChat'
import {
  toPublicApplicationPayload,
  validatePublicApplicationForm,
  type PublicApplicationFormValues,
} from '../services/publicApplicationForm'
import type { Job, PublicScreeningQuestion } from '../types/user'

type JobLoadError = 'not-found' | 'network' | 'server' | null

const screeningChatEnabled = isScreeningChatEnabled()

export function JobDetailPage() {
  const { slug = '' } = useParams()
  const [job, setJob] = useState<Job | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [focusRequest, setFocusRequest] = useState(0)
  const [loadError, setLoadError] = useState<JobLoadError>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [formError, setFormError] = useState('')
  const [formNotice, setFormNotice] = useState('')
  const [step, setStep] = useState<ApplicationStep>('form')
  const [screeningToken, setScreeningToken] = useState('')
  const [applicationReference, setApplicationReference] = useState('')
  const [chatUnavailable, setChatUnavailable] = useState(false)
  const [screeningQuestions, setScreeningQuestions] = useState<PublicScreeningQuestion[]>([])
  const [screeningAnswers, setScreeningAnswers] = useState<ScreeningAnswers>({})
  const [screeningError, setScreeningError] = useState('')
  const [isSubmittingScreening, setIsSubmittingScreening] = useState(false)
  const [formValues, setFormValues] = useState<PublicApplicationFormValues>({
    full_name: '',
    email: '',
    phone: '',
    city: '',
    neighborhood: '',
    privacy_accepted: false,
  })
  const formRef = useRef<HTMLFormElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const stepRef = useRef<HTMLDivElement>(null)

  function updateField<Key extends keyof PublicApplicationFormValues>(field: Key, value: PublicApplicationFormValues[Key]) {
    setFormValues((currentValues) => ({ ...currentValues, [field]: value }))
  }

  function openApplicationForm() {
    setShowForm(true)
    setFocusRequest((request) => request + 1)
  }

  async function loadScreeningQuestions(token: string): Promise<PublicScreeningQuestion[]> {
    // The token endpoint is the source of truth; the job payload is the fallback if it fails.
    try {
      return (await getPublicScreening(token)).questions
    } catch {
      return job?.screening_questions ?? []
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || screeningToken) return
    setFormError('')
    setFormNotice('')

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
      const questions = response.screening_completed ? [] : await loadScreeningQuestions(response.public_screening_token)
      setScreeningQuestions(questions)
      setStep(stepAfterApplication(response.screening_completed, questions))
    } catch (err) {
      // Already applied (409): not an error for the person, just reassurance.
      if (err instanceof ApiError && err.status === 409) setFormNotice(err.message)
      else setFormError(err instanceof Error ? err.message : 'Não foi possível enviar sua candidatura.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function updateScreeningAnswer(questionId: number, value: boolean | string) {
    setScreeningAnswers((currentAnswers) => ({ ...currentAnswers, [questionId]: value }))
  }

  async function handleScreeningSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!screeningToken || isSubmittingScreening) return

    if (firstMissingRequiredAnswer(screeningQuestions, screeningAnswers)) {
      setScreeningError(MISSING_SCREENING_ANSWER_MESSAGE)
      return
    }

    setIsSubmittingScreening(true)
    setScreeningError('')
    try {
      await submitScreeningAnswers(screeningToken, { answers: toScreeningAnswers(screeningQuestions, screeningAnswers) })
      setStep('done')
    } catch (err) {
      setScreeningError(err instanceof Error ? err.message : 'Não foi possível enviar suas respostas.')
    } finally {
      setIsSubmittingScreening(false)
    }
  }

  // Only on request (never automatically), and only with the flag on. The chat gets the reference, no personal data.
  function openScreeningChat() {
    if (!applicationReference) return
    const result = openAppIntelliOptions(toRecruitmentScreeningOpenOptions(applicationReference))
    setChatUnavailable(result === 'unavailable')
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

  // "Candidatar-se": bring the form into view and put the cursor in the first field (matters on phones).
  useEffect(() => {
    if (focusRequest === 0) return
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    firstFieldRef.current?.focus({ preventScroll: true })
  }, [focusRequest])

  // The form disappears after sending: show the questions or the confirmation where the person is looking.
  useEffect(() => {
    if (step === 'form') return
    stepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  const salary = job ? formatSalary(job) : ''
  const workMode = job ? formatWorkMode(job.work_mode) : ''

  return (
    <Container className="py-12">
      <Link to="/vagas" className="text-sm font-black text-brand-700 transition hover:text-brand-600">
        Voltar para vagas
      </Link>

      {isLoading ? (
        <div className="mt-8">
          <JobsLoading label="Carregando vaga..." count={1} />
        </div>
      ) : null}
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

            {step === 'form' ? (
              <Button type="button" className="mt-8" onClick={openApplicationForm}>
                Candidatar-se
              </Button>
            ) : null}

            {step === 'form' && showForm ? (
              <form
                ref={formRef}
                onSubmit={(event) => void handleSubmit(event)}
                className="mt-8 grid scroll-mt-24 gap-5 border-t border-slate-200 pt-8"
              >
                <div>
                  <h2 className="text-xl font-black text-ink-950">Enviar candidatura</h2>
                  <p className="mt-2 text-sm leading-6 text-ink-600">
                    Preencha seus dados principais para participar deste processo seletivo.
                  </p>
                </div>

                {formError ? <Alert tone="error">{formError}</Alert> : null}
                {formNotice ? <Alert tone="info">{formNotice}</Alert> : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <label htmlFor="application_full_name" className="grid gap-2 text-sm font-bold text-ink-800">
                    Nome completo
                    <input
                      id="application_full_name"
                      ref={firstFieldRef}
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
                    Bairro (opcional)
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
                    Li e concordo com o tratamento dos meus dados pela AK Talent para participação neste processo seletivo,
                    conforme a{' '}
                    <a
                      href={PRIVACY_POLICY_PATH}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-brand-700 underline underline-offset-2 hover:text-brand-600"
                    >
                      Política de Privacidade
                    </a>
                    .
                  </span>
                </label>

                <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
                  Enviar candidatura
                </Button>
              </form>
            ) : null}

            {step === 'questions' ? (
              <div ref={stepRef} className="mt-8 scroll-mt-24 border-t border-slate-200 pt-8">
                <Alert tone="success">Recebemos seus dados. Falta só responder as perguntas abaixo.</Alert>
                <form onSubmit={(event) => void handleScreeningSubmit(event)} className="mt-6 grid gap-5">
                  <div>
                    <h2 className="text-xl font-black text-ink-950">Perguntas da vaga</h2>
                    <p className="mt-2 text-sm leading-6 text-ink-600">
                      São rápidas e ajudam a equipe AK Talent a analisar sua candidatura.
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
                            <label
                              key={String(option.value)}
                              className="flex min-h-12 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-ink-700"
                            >
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
                    Concluir candidatura
                  </Button>

                  {screeningChatEnabled && applicationReference ? (
                    <p className="text-sm leading-6 text-ink-600">
                      Prefere responder conversando?{' '}
                      <button
                        type="button"
                        onClick={openScreeningChat}
                        className="font-bold text-brand-700 underline underline-offset-2 hover:text-brand-600"
                      >
                        Abrir o chat
                      </button>
                      {chatUnavailable ? <span className="block text-red-700">{SCREENING_CHAT_UNAVAILABLE_MESSAGE}</span> : null}
                    </p>
                  ) : null}
                </form>
              </div>
            ) : null}

            {step === 'done' ? (
              <div ref={stepRef} className="mt-8 scroll-mt-24 rounded-lg border border-emerald-200 bg-emerald-50 p-6">
                <h2 className="text-xl font-black text-ink-950">{APPLICATION_CONFIRMATION_TITLE}</h2>
                <p className="mt-2 text-base leading-7 text-ink-700">{APPLICATION_CONFIRMATION_MESSAGE}</p>
                <Link
                  to="/vagas"
                  className="mt-5 inline-flex min-h-12 items-center rounded-lg bg-brand-700 px-5 text-sm font-black text-white transition hover:bg-brand-600"
                >
                  Ver outras vagas
                </Link>
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
    </Container>
  )
}
