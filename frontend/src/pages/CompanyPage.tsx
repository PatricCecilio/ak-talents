import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { AiComingSoon } from '../components/AiComingSoon'
import { AIOnboardingWizard } from '../components/company/AIOnboardingWizard'
import { FinalistsSection } from '../components/company/FinalistsSection'
import { FormField } from '../components/FormField'
import { Alert, Badge, Button, Card, EmptyState, LoadingSpinner, PageHeader, Select, Textarea } from '../components/ui'
import { useAiAvailable } from '../hooks/useAiAvailable'
import { useFormState } from '../hooks/useFormState'
import { DashboardShell } from '../layouts/DashboardShell'
import { getCurrentUser, logout } from '../services/authService'
import { companyJobProgress } from '../services/companyProgress'
import { companySizeOptions, toCompanyProfilePayload, validateCompanyProfile } from '../services/companyProfileForm'
import { CONTRACT_TYPE_OPTIONS, formatJobStatus, formatWorkMode } from '../services/jobFormat'
import { createJob, getJobMatches, getMyCompanyJobs } from '../services/jobService'
import { getSalaryRangeError, JOB_SENT_MESSAGE } from '../services/jobValidation'
import { LOGIN_CHOOSER_PATH } from '../services/loginDoors'
import { getCompanyProfile, updateCompanyProfile } from '../services/profileService'
import type { CandidateMatch, ContractType, Job } from '../types/user'

function toOptionalNumber(value: string) {
  return value.trim() ? Number(value) : null
}

export function CompanyPage() {
  const user = getCurrentUser()
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = useState(true)
  const [isLoadingCompanyProfile, setIsLoadingCompanyProfile] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingCompanyProfile, setIsSavingCompanyProfile] = useState(false)
  const [creationMode, setCreationMode] = useState<'ai' | 'manual'>('manual')
  const aiAvailable = useAiAvailable()
  const [loadingMatchesJobId, setLoadingMatchesJobId] = useState<number | null>(null)
  const [matchesByJobId, setMatchesByJobId] = useState<Record<number, CandidateMatch[]>>({})
  const [matchErrorsByJobId, setMatchErrorsByJobId] = useState<Record<number, string>>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [companyProfileError, setCompanyProfileError] = useState('')
  const [companyProfileSuccess, setCompanyProfileSuccess] = useState('')
  const {
    values: companyProfileValues,
    updateField: updateCompanyProfileField,
    setFormValues: setCompanyProfileValues,
  } = useFormState({
    company_name: '',
    responsible_name: '',
    phone: '',
    city: '',
    state: '',
    industry: '',
    company_size: '',
    description: '',
    website_url: '',
  })
  const { values, updateField, reset } = useFormState({
    title: '',
    description: '',
    requirements: '',
    salary_min: '',
    salary_max: '',
    location: '',
    work_mode: 'onsite',
    schedule: '',
    benefits: '',
    contract_type: '',
    openings: '',
  })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const salaryMin = toOptionalNumber(values.salary_min)
    const salaryMax = toOptionalNumber(values.salary_max)
    const salaryError = getSalaryRangeError(salaryMin, salaryMax)
    if (salaryError) {
      setError(salaryError)
      return
    }

    setIsSubmitting(true)
    try {
      const createdJob = await createJob({
        title: values.title,
        description: values.description,
        requirements: values.requirements,
        salary_min: salaryMin,
        salary_max: salaryMax,
        location: values.location,
        work_mode: values.work_mode,
        schedule: values.schedule.trim() || null,
        benefits: values.benefits.trim() || null,
        contract_type: (values.contract_type || null) as ContractType | null,
        openings: toOptionalNumber(values.openings),
      })
      setJobs((currentJobs) => [createdJob, ...currentJobs])
      reset()
      setSuccess(JOB_SENT_MESSAGE)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a vaga.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCompanyProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCompanyProfileError('')
    setCompanyProfileSuccess('')

    const validation = validateCompanyProfile(companyProfileValues)
    if (!validation.isValid) {
      setCompanyProfileError(validation.message)
      return
    }

    setIsSavingCompanyProfile(true)
    try {
      await updateCompanyProfile(toCompanyProfilePayload(companyProfileValues))
      setCompanyProfileSuccess('Perfil da empresa salvo com sucesso.')
    } catch (err) {
      setCompanyProfileError(err instanceof Error ? err.message : 'Não foi possível salvar o perfil da empresa.')
    } finally {
      setIsSavingCompanyProfile(false)
    }
  }

  async function handleViewMatches(jobId: number) {
    setLoadingMatchesJobId(jobId)
    setMatchErrorsByJobId((currentErrors) => ({
      ...currentErrors,
      [jobId]: '',
    }))

    try {
      const response = await getJobMatches(jobId)
      setMatchesByJobId((currentMatches) => ({
        ...currentMatches,
        [jobId]: response,
      }))
    } catch (err) {
      setMatchErrorsByJobId((currentErrors) => ({
        ...currentErrors,
        [jobId]: err instanceof Error ? err.message : 'Não foi possível carregar os candidatos inscritos.',
      }))
    } finally {
      setLoadingMatchesJobId(null)
    }
  }

  useEffect(() => {
    let isMounted = true

    getMyCompanyJobs()
      .then((response) => {
        if (isMounted) {
          setJobs(response)
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Não foi possível carregar as vagas.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingJobs(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    getCompanyProfile()
      .then((profile) => {
        if (isMounted) {
          setCompanyProfileValues({
            company_name: profile.company_name ?? '',
            responsible_name: profile.responsible_name ?? '',
            phone: profile.phone ?? '',
            city: profile.city ?? '',
            state: profile.state ?? '',
            industry: profile.industry ?? '',
            company_size: profile.company_size ?? '',
            description: profile.description ?? '',
            website_url: profile.website_url ?? '',
          })
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setCompanyProfileError(err instanceof Error ? err.message : 'Não foi possível carregar o perfil da empresa.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingCompanyProfile(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [setCompanyProfileValues])

  return (
    <DashboardShell active="company">
      <PageHeader
        eyebrow="Dashboard empresa"
        title="Contrate com menos complexidade."
        description={`${user?.name ? `${user.name}, ` : ''}publique sua vaga em poucos minutos. A equipe AK Talent revisa, divulga e faz a seleção com você.`}
        action={
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              logout()
              window.location.href = LOGIN_CHOOSER_PATH
            }}
          >
            Sair
          </Button>
        }
      />

      <div id="finalistas" className="mt-8 scroll-mt-28">
        <FinalistsSection />
      </div>

      <div id="nova-vaga" className="mt-10 grid scroll-mt-28 gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setCreationMode('manual')}
          className={`rounded-lg border p-5 text-left transition ${
            creationMode === 'manual'
              ? 'border-gold-500 bg-amber-50 shadow-sm'
              : 'border-slate-200 bg-white hover:border-gold-500'
          }`}
        >
          <p className="text-sm font-black uppercase tracking-[0.18em] text-brand-700">Criar vaga</p>
          <h2 className="mt-2 text-xl font-black text-ink-950">Preencha os dados da vaga</h2>
          <p className="mt-2 text-sm leading-6 text-ink-600">
            Complete o perfil da empresa e descreva a vaga campo por campo.
          </p>
        </button>

        {aiAvailable ? (
          <button
            type="button"
            onClick={() => setCreationMode('ai')}
            className={`rounded-lg border p-5 text-left transition ${
              creationMode === 'ai'
                ? 'border-gold-500 bg-amber-50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-gold-500'
            }`}
          >
            <p className="text-sm font-black uppercase tracking-[0.18em] text-gold-500">Criar vaga com IA</p>
            <h2 className="mt-2 text-xl font-black text-ink-950">Experiência guiada</h2>
            <p className="mt-2 text-sm leading-6 text-ink-600">
              Responda perguntas simples. A IA organiza empresa, vaga, requisitos e descrição.
            </p>
          </button>
        ) : (
          <AiComingSoon
            eyebrow="Criar vaga com IA"
            title="Experiência guiada"
            description="Em breve, a IA vai ajudar a escrever a vaga a partir de perguntas simples."
          />
        )}
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="grid gap-8">
          {creationMode === 'ai' && aiAvailable ? (
            <AIOnboardingWizard onJobCreated={(job) => setJobs((currentJobs) => [job, ...currentJobs])} />
          ) : null}

          {creationMode === 'manual' ? (
            <>
              <Card className="p-6">
                <form onSubmit={handleCompanyProfileSubmit} className="grid gap-5">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.22em] text-brand-700">Perfil da Empresa</p>
                    <h2 className="mt-2 text-2xl font-black text-ink-950">Complete os dados da empresa.</h2>
                    <p className="mt-2 text-sm leading-6 text-ink-600">
                      Esses dados ajudam candidatos e melhoram a qualidade das vagas publicadas.
                    </p>
                  </div>

                  {isLoadingCompanyProfile ? <LoadingSpinner label="Carregando perfil da empresa..." /> : null}
                  {companyProfileError ? <Alert tone="error">{companyProfileError}</Alert> : null}
                  {companyProfileSuccess ? <Alert tone="success">{companyProfileSuccess}</Alert> : null}

                  <p className="text-sm text-ink-600">Campos com * são obrigatórios.</p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      id="company_name"
                      label="Nome da empresa *"
                      value={companyProfileValues.company_name}
                      placeholder="Mercado Bom Preço"
                      autoComplete="organization"
                      onChange={(value) => updateCompanyProfileField('company_name', value)}
                    />
                    <FormField
                      id="responsible_name"
                      label="Responsável *"
                      value={companyProfileValues.responsible_name}
                      placeholder="Ana Costa"
                      autoComplete="name"
                      onChange={(value) => updateCompanyProfileField('responsible_name', value)}
                    />
                    <FormField
                      id="company_phone"
                      label="Telefone *"
                      type="tel"
                      value={companyProfileValues.phone}
                      placeholder="(41) 99999-9999"
                      autoComplete="tel"
                      onChange={(value) => updateCompanyProfileField('phone', value)}
                    />
                    <FormField
                      id="company_city"
                      label="Cidade *"
                      value={companyProfileValues.city}
                      placeholder="Curitiba"
                      onChange={(value) => updateCompanyProfileField('city', value)}
                    />
                    <FormField
                      id="company_state"
                      label="Estado *"
                      value={companyProfileValues.state}
                      placeholder="PR"
                      onChange={(value) => updateCompanyProfileField('state', value)}
                    />
                    <FormField
                      id="industry"
                      label="Segmento (opcional)"
                      value={companyProfileValues.industry}
                      placeholder="Comércio, restaurante, serviços..."
                      required={false}
                      onChange={(value) => updateCompanyProfileField('industry', value)}
                    />
                    <Select
                      id="company_size"
                      label="Tamanho (opcional)"
                      value={companyProfileValues.company_size}
                      onChange={(event) => updateCompanyProfileField('company_size', event.target.value)}
                    >
                      <option value="">Selecione</option>
                      {companySizeOptions(companyProfileValues.company_size).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                    <FormField
                      id="website_url"
                      label="Site (opcional)"
                      type="url"
                      value={companyProfileValues.website_url}
                      placeholder="https://suaempresa.com.br"
                      required={false}
                      onChange={(value) => updateCompanyProfileField('website_url', value)}
                    />
                  </div>

                  <Textarea
                    id="company_description"
                    label="Descrição (opcional)"
                    value={companyProfileValues.description}
                    placeholder="Conte em poucas linhas o que a empresa faz e como é trabalhar nela."
                    onChange={(event) => updateCompanyProfileField('description', event.target.value)}
                    rows={4}
                  />

                  <Button type="submit" isLoading={isSavingCompanyProfile}>
                    Salvar perfil
                  </Button>
                </form>
              </Card>

              <Card className="p-6">
                <form onSubmit={handleSubmit} className="grid gap-5">
                  <div>
                    <h2 className="text-2xl font-black text-ink-950">Nova vaga</h2>
                    <p className="mt-2 text-sm leading-6 text-ink-600">Preencha os dados principais da oportunidade.</p>
                  </div>

                  {error ? <Alert tone="error">{error}</Alert> : null}
                  {success ? <Alert tone="success">{success}</Alert> : null}

                  <FormField
                    id="title"
                    label="Título da vaga"
                    value={values.title}
                    placeholder="Atendente de loja"
                    onChange={(value) => updateField('title', value)}
                  />
                  <Textarea
                    id="description"
                    label="Descrição da vaga"
                    value={values.description}
                    placeholder="Atender clientes no balcão, organizar a loja, operar o caixa e repor produtos."
                    onChange={(event) => updateField('description', event.target.value)}
                    required
                    rows={5}
                  />
                  <Textarea
                    id="requirements"
                    label="Requisitos"
                    value={values.requirements}
                    placeholder="Ensino médio completo. Gostar de atender pessoas. Experiência com caixa é um diferencial."
                    onChange={(event) => updateField('requirements', event.target.value)}
                    rows={4}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      id="salary_min"
                      label="Salário mínimo"
                      type="number"
                      value={values.salary_min}
                      placeholder="1800"
                      onChange={(value) => updateField('salary_min', value)}
                    />
                    <FormField
                      id="salary_max"
                      label="Salário máximo"
                      type="number"
                      value={values.salary_max}
                      placeholder="2200"
                      onChange={(value) => updateField('salary_max', value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      id="location"
                      label="Cidade da vaga"
                      value={values.location}
                      placeholder="Curitiba, PR"
                      onChange={(value) => updateField('location', value)}
                    />
                    <Select
                      id="work_mode"
                      label="Modelo de trabalho"
                      value={values.work_mode}
                      onChange={(event) => updateField('work_mode', event.target.value)}
                    >
                      <option value="onsite">Presencial</option>
                      <option value="hybrid">Híbrido</option>
                      <option value="remote">Remoto</option>
                    </Select>
                  </div>

                  <div className="grid gap-4 border-t border-slate-200 pt-5">
                    <p className="text-sm leading-6 text-ink-600">
                      Opcional, mas é o que o candidato mais quer saber: aparece em destaque na página da vaga.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Select
                        id="contract_type"
                        label="Tipo de contrato"
                        value={values.contract_type}
                        onChange={(event) => updateField('contract_type', event.target.value)}
                      >
                        <option value="">Selecione</option>
                        {CONTRACT_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                      <FormField
                        id="openings"
                        label="Quantidade de vagas"
                        type="number"
                        value={values.openings}
                        placeholder="1"
                        required={false}
                        onChange={(value) => updateField('openings', value)}
                      />
                    </div>
                    <FormField
                      id="schedule"
                      label="Horário ou escala"
                      value={values.schedule}
                      placeholder="Seg a sáb, 8h às 16h20 (escala 6x1)"
                      required={false}
                      onChange={(value) => updateField('schedule', value)}
                    />
                    <Textarea
                      id="benefits"
                      label="Benefícios"
                      value={values.benefits}
                      placeholder="Vale-transporte, vale-refeição, plano de saúde..."
                      onChange={(event) => updateField('benefits', event.target.value)}
                      rows={3}
                    />
                  </div>

                  <Button type="submit" isLoading={isSubmitting}>
                    Enviar vaga
                  </Button>
                </form>
              </Card>
            </>
          ) : null}
        </div>

        <Card id="suas-vagas" className="scroll-mt-28 p-6">
          <h2 className="text-2xl font-black text-ink-950">Suas vagas</h2>
          <p className="mt-2 text-sm leading-6 text-ink-600">
            Acompanhe a aprovação de cada vaga e os candidatos que se inscreveram nela.
          </p>

          <div className="mt-6 grid gap-4">
            {isLoadingJobs ? <LoadingSpinner label="Carregando vagas..." /> : null}

            {!isLoadingJobs && jobs.length === 0 ? (
              <EmptyState
                title="Você ainda não criou vagas."
                description="Crie uma vaga com IA ou manualmente. Ela aparece para candidatos depois da aprovação da equipe AK Talent."
              />
            ) : null}

            {jobs.map((job) => (
              <article key={job.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                  {formatWorkMode(job.work_mode) || 'Modelo não informado'}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-black text-ink-950">{job.title}</h3>
                  <Badge status={(job.status || 'approved') as 'pending' | 'approved' | 'blocked' | 'hidden'}>
                    {formatJobStatus(job.status || 'approved')}
                  </Badge>
                </div>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-600">{job.description}</p>
                <p className="mt-3 text-sm font-bold text-ink-700">{job.location || 'Cidade não informada'}</p>
                <ul className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink-700" aria-label="Andamento da vaga">
                  {companyJobProgress(job.stage_counts).map((item) => (
                    <li key={item.label} className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
                      {item.label}: {item.value}
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="secondary"
                  isLoading={loadingMatchesJobId === job.id}
                  onClick={() => void handleViewMatches(job.id)}
                  className="mt-4"
                >
                  Ver candidatos inscritos
                </Button>

                {matchErrorsByJobId[job.id] ? (
                  <div className="mt-4">
                    <Alert tone="error">{matchErrorsByJobId[job.id]}</Alert>
                  </div>
                ) : null}

                {matchesByJobId[job.id] ? (
                  <div className="mt-4 grid gap-3">
                    {matchesByJobId[job.id].length === 0 ? <EmptyState title="Ainda não há candidaturas para esta vaga." /> : null}

                    {matchesByJobId[job.id].map((match) => (
                      <div key={match.candidate_id} className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-black text-ink-950">{match.name}</p>
                          <span className="grid h-12 w-12 place-items-center rounded-full bg-gold-500 text-sm font-black text-ink-950 shadow-sm">
                            {match.score}
                          </span>
                        </div>
                        <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink-600">
                          {match.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </Card>
      </div>
    </DashboardShell>
  )
}
