import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { AIOnboardingWizard } from '../components/company/AIOnboardingWizard'
import { FormField } from '../components/FormField'
import { Alert, Badge, Button, Card, EmptyState, LoadingSpinner, PageHeader, Select, Textarea } from '../components/ui'
import { useFormState } from '../hooks/useFormState'
import { DashboardShell } from '../layouts/DashboardShell'
import { getCurrentUser, logout } from '../services/authService'
import { createJob, getJobMatches, getJobs } from '../services/jobService'
import { getCompanyProfile, updateCompanyProfile } from '../services/profileService'
import type { CandidateMatch, Job } from '../types/user'

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
  const [creationMode, setCreationMode] = useState<'ai' | 'manual'>('ai')
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
    work_mode: 'remote',
  })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const createdJob = await createJob({
        title: values.title,
        description: values.description,
        requirements: values.requirements,
        salary_min: toOptionalNumber(values.salary_min),
        salary_max: toOptionalNumber(values.salary_max),
        location: values.location,
        work_mode: values.work_mode,
      })
      setJobs((currentJobs) => [createdJob, ...currentJobs])
      reset()
      setSuccess('Vaga criada com sucesso. Ela pode precisar de aprovacao do admin antes de aparecer para candidatos.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel criar a vaga.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCompanyProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingCompanyProfile(true)
    setCompanyProfileError('')
    setCompanyProfileSuccess('')

    try {
      await updateCompanyProfile({
        company_name: companyProfileValues.company_name,
        responsible_name: companyProfileValues.responsible_name,
        phone: companyProfileValues.phone,
        city: companyProfileValues.city,
        state: companyProfileValues.state,
        industry: companyProfileValues.industry,
        company_size: companyProfileValues.company_size,
        description: companyProfileValues.description,
        website_url: companyProfileValues.website_url,
      })
      setCompanyProfileSuccess('Perfil da empresa salvo com sucesso.')
    } catch (err) {
      setCompanyProfileError(err instanceof Error ? err.message : 'Nao foi possivel salvar o perfil da empresa.')
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
        [jobId]: err instanceof Error ? err.message : 'Nao foi possivel carregar candidatos compativeis.',
      }))
    } finally {
      setLoadingMatchesJobId(null)
    }
  }

  useEffect(() => {
    let isMounted = true

    getJobs()
      .then((response) => {
        if (isMounted) {
          setJobs(response)
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Nao foi possivel carregar as vagas.')
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
          setCompanyProfileError(err instanceof Error ? err.message : 'Nao foi possivel carregar o perfil da empresa.')
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
        description={`${user?.name ? `${user.name}, ` : ''}use a IA para cadastrar sua empresa e criar uma vaga em poucos minutos, ou continue pelo modo manual.`}
        action={
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              logout()
              window.location.href = '/login'
            }}
          >
            Sair
          </Button>
        }
      />

      <div className="mt-8 grid gap-4 md:grid-cols-2">
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
          <h2 className="mt-2 text-xl font-black text-ink-950">Experiencia guiada</h2>
          <p className="mt-2 text-sm leading-6 text-ink-600">
            Responda perguntas simples. A IA organiza empresa, vaga, requisitos e descricao.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setCreationMode('manual')}
          className={`rounded-lg border p-5 text-left transition ${
            creationMode === 'manual'
              ? 'border-gold-500 bg-amber-50 shadow-sm'
              : 'border-slate-200 bg-white hover:border-gold-500'
          }`}
        >
          <p className="text-sm font-black uppercase tracking-[0.18em] text-brand-700">Criar vaga manualmente</p>
          <h2 className="mt-2 text-xl font-black text-ink-950">Controle completo</h2>
          <p className="mt-2 text-sm leading-6 text-ink-600">
            Edite o perfil da empresa e preencha os dados da vaga campo por campo.
          </p>
        </button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        <div className="grid gap-8">
          {creationMode === 'ai' ? (
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

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      id="company_name"
                      label="Nome da empresa"
                      value={companyProfileValues.company_name}
                      placeholder="AK Talent"
                      onChange={(value) => updateCompanyProfileField('company_name', value)}
                    />
                    <FormField
                      id="responsible_name"
                      label="Responsavel"
                      value={companyProfileValues.responsible_name}
                      placeholder="Ana Costa"
                      onChange={(value) => updateCompanyProfileField('responsible_name', value)}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      id="company_phone"
                      label="Telefone"
                      value={companyProfileValues.phone}
                      placeholder="(11) 99999-9999"
                      onChange={(value) => updateCompanyProfileField('phone', value)}
                    />
                    <FormField
                      id="company_city"
                      label="Cidade"
                      value={companyProfileValues.city}
                      placeholder="Sao Paulo"
                      onChange={(value) => updateCompanyProfileField('city', value)}
                    />
                    <FormField
                      id="company_state"
                      label="Estado"
                      value={companyProfileValues.state}
                      placeholder="SP"
                      onChange={(value) => updateCompanyProfileField('state', value)}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      id="industry"
                      label="Segmento"
                      value={companyProfileValues.industry}
                      placeholder="Tecnologia"
                      onChange={(value) => updateCompanyProfileField('industry', value)}
                    />
                    <FormField
                      id="company_size"
                      label="Tamanho"
                      value={companyProfileValues.company_size}
                      placeholder="51-200 colaboradores"
                      onChange={(value) => updateCompanyProfileField('company_size', value)}
                    />
                    <FormField
                      id="website_url"
                      label="Website"
                      value={companyProfileValues.website_url}
                      placeholder="https://empresa.com"
                      onChange={(value) => updateCompanyProfileField('website_url', value)}
                    />
                  </div>

                  <Textarea
                    id="company_description"
                    label="Descricao"
                    value={companyProfileValues.description}
                    placeholder="Conte sobre a empresa, cultura, produto e momento de crescimento"
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
                    <h2 className="text-2xl font-black text-ink-950">Nova vaga manual</h2>
                    <p className="mt-2 text-sm leading-6 text-ink-600">Preencha os dados principais da oportunidade.</p>
                  </div>

                  {error ? <Alert tone="error">{error}</Alert> : null}
                  {success ? <Alert tone="success">{success}</Alert> : null}

                  <FormField
                    id="title"
                    label="Titulo da vaga"
                    value={values.title}
                    placeholder="Product Designer Senior"
                    onChange={(value) => updateField('title', value)}
                  />
                  <Textarea
                    id="description"
                    label="Descricao da vaga"
                    value={values.description}
                    placeholder="Descreva responsabilidades, contexto e impacto da vaga"
                    onChange={(event) => updateField('description', event.target.value)}
                    required
                    rows={5}
                  />
                  <Textarea
                    id="requirements"
                    label="Requisitos"
                    value={values.requirements}
                    placeholder="Liste habilidades, senioridade e requisitos obrigatorios"
                    onChange={(event) => updateField('requirements', event.target.value)}
                    rows={4}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      id="salary_min"
                      label="Salario minimo"
                      type="number"
                      value={values.salary_min}
                      placeholder="6000"
                      onChange={(value) => updateField('salary_min', value)}
                    />
                    <FormField
                      id="salary_max"
                      label="Salario maximo"
                      type="number"
                      value={values.salary_max}
                      placeholder="10000"
                      onChange={(value) => updateField('salary_max', value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      id="location"
                      label="Cidade da vaga"
                      value={values.location}
                      placeholder="Sao Paulo, SP"
                      onChange={(value) => updateField('location', value)}
                    />
                    <Select
                      id="work_mode"
                      label="Modelo de trabalho"
                      value={values.work_mode}
                      onChange={(event) => updateField('work_mode', event.target.value)}
                    >
                      <option value="remote">Remoto</option>
                      <option value="hybrid">Hibrido</option>
                      <option value="onsite">Presencial</option>
                    </Select>
                  </div>

                  <Button type="submit" isLoading={isSubmitting}>
                    Criar vaga
                  </Button>
                </form>
              </Card>
            </>
          ) : null}
        </div>

        <Card className="p-6">
          <h2 className="text-2xl font-black text-ink-950">Vagas publicadas</h2>
          <p className="mt-2 text-sm leading-6 text-ink-600">Acompanhe status, matches e aprovacao das suas vagas.</p>

          <div className="mt-6 grid gap-4">
            {isLoadingJobs ? <LoadingSpinner label="Carregando vagas..." /> : null}

            {!isLoadingJobs && jobs.length === 0 ? (
              <EmptyState
                title="Nenhuma vaga publicada ainda."
                description="Crie uma vaga com IA ou manualmente. Ela pode precisar de aprovacao do admin."
              />
            ) : null}

            {jobs.map((job) => (
              <article key={job.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">
                  {job.work_mode || 'Modelo nao informado'}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-black text-ink-950">{job.title}</h3>
                  <Badge status={job.status as 'pending' | 'approved' | 'blocked' | 'hidden'}>{job.status}</Badge>
                </div>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-600">{job.description}</p>
                <p className="mt-3 text-sm font-bold text-ink-700">{job.location || 'Cidade nao informada'}</p>
                <Button
                  type="button"
                  variant="secondary"
                  isLoading={loadingMatchesJobId === job.id}
                  onClick={() => void handleViewMatches(job.id)}
                  className="mt-4"
                >
                  Ver candidatos compativeis
                </Button>

                {matchErrorsByJobId[job.id] ? (
                  <div className="mt-4">
                    <Alert tone="error">{matchErrorsByJobId[job.id]}</Alert>
                  </div>
                ) : null}

                {matchesByJobId[job.id] ? (
                  <div className="mt-4 grid gap-3">
                    {matchesByJobId[job.id].length === 0 ? <EmptyState title="Nenhum candidato encontrado." /> : null}

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
