import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { AIResultList } from '../components/AIResultList'
import { AiComingSoon } from '../components/AiComingSoon'
import { FormField } from '../components/FormField'
import { MyApplicationsSection } from '../components/candidate/MyApplicationsSection'
import { Alert, Button, Card, EmptyState, Input, LoadingSpinner, PageHeader } from '../components/ui'
import { useFormState } from '../hooks/useFormState'
import { useAiAvailable } from '../hooks/useAiAvailable'
import { DashboardShell } from '../layouts/DashboardShell'
import { createApplication } from '../services/applicationService'
import { generateCandidateProfile } from '../services/aiService'
import { getCurrentUser, logout } from '../services/authService'
import {
  toCandidateProfilePayload,
  validateCandidateProfile,
  type CandidateProfileErrors,
  type CandidateProfileFormValues,
} from '../services/fieldValidation'
import { formatWorkMode } from '../services/jobFormat'
import { getJobs } from '../services/jobService'
import { LOGIN_CHOOSER_PATH } from '../services/loginDoors'
import { getCandidateProfile, updateCandidateProfile } from '../services/profileService'
import type { CandidateProfileAIResponse } from '../types/ai'
import type { Job } from '../types/user'

// Field -> input id, in screen order (focus goes to the first field with a problem).
const PROFILE_FIELD_IDS: Record<keyof CandidateProfileFormValues, string> = {
  full_name: 'profile_full_name',
  phone: 'profile_phone',
  city: 'profile_city',
  state: 'profile_state',
  desired_role: 'profile_desired_role',
  professional_summary: 'profile_summary',
  skills: 'profile_skills',
  experience_years: 'profile_experience',
  salary_expectation: 'profile_salary',
  work_mode: 'profile_work_mode',
  linkedin_url: 'profile_linkedin',
  portfolio_url: 'profile_portfolio',
  resume_url: 'profile_resume',
}

function formatSalary(job: Job) {
  if (job.salary_min && job.salary_max) {
    return `R$ ${job.salary_min.toLocaleString('pt-BR')} - R$ ${job.salary_max.toLocaleString('pt-BR')}`
  }

  if (job.salary_min) {
    return `A partir de R$ ${job.salary_min.toLocaleString('pt-BR')}`
  }

  if (job.salary_max) {
    return `Até R$ ${job.salary_max.toLocaleString('pt-BR')}`
  }

  return 'Salário a combinar'
}

export function CandidatePage() {
  const user = getCurrentUser()
  const aiAvailable = useAiAvailable()
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [applyingJobId, setApplyingJobId] = useState<number | null>(null)
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [careerAIError, setCareerAIError] = useState('')
  const [careerAISuccess, setCareerAISuccess] = useState('')
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [careerAIResult, setCareerAIResult] = useState<CandidateProfileAIResponse | null>(null)
  const { values: profileValues, updateField: updateProfileField, setFormValues: setProfileValues } = useFormState<CandidateProfileFormValues>({
    full_name: '',
    phone: '',
    city: '',
    state: '',
    desired_role: '',
    professional_summary: '',
    skills: '',
    experience_years: '',
    salary_expectation: '',
    work_mode: '',
    linkedin_url: '',
    portfolio_url: '',
    resume_url: '',
  })
  const [profileEmail, setProfileEmail] = useState('')
  const [profileErrors, setProfileErrors] = useState<CandidateProfileErrors>({})

  function changeProfileField(field: keyof CandidateProfileFormValues, value: string) {
    updateProfileField(field, value)
    // The message under a field goes away as soon as the person fixes it.
    setProfileErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))
  }
  const { values: aiValues, updateField: updateAIField } = useFormState({
    desired_role: '',
    experience: '',
    skills: '',
    city: '',
    work_mode: 'remote',
    salary_expectation: '',
  })

  const [applicationsRefreshKey, setApplicationsRefreshKey] = useState(0)

  async function handleApply(jobId: number) {
    setApplyingJobId(jobId)
    setError('')
    setSuccess('')

    try {
      await createApplication({ job_id: jobId })
      setSuccess('Candidatura enviada com sucesso.')
      setApplicationsRefreshKey((key) => key + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar a candidatura.')
    } finally {
      setApplyingJobId(null)
    }
  }

  async function handleCareerAI(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsGeneratingProfile(true)
    setCareerAIError('')
    setCareerAISuccess('')

    try {
      const response = await generateCandidateProfile(aiValues)
      setCareerAIResult(response)
      setCareerAISuccess('Perfil profissional gerado com sucesso.')
    } catch (err) {
      setCareerAIError(err instanceof Error ? err.message : 'Não foi possível gerar seu perfil com IA.')
    } finally {
      setIsGeneratingProfile(false)
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileError('')
    setProfileSuccess('')

    const errors = validateCandidateProfile(profileValues)
    setProfileErrors(errors)
    const firstInvalid = (Object.keys(PROFILE_FIELD_IDS) as Array<keyof CandidateProfileFormValues>).find((field) => errors[field])
    if (firstInvalid) {
      document.getElementById(PROFILE_FIELD_IDS[firstInvalid])?.focus()
      return
    }

    setIsSavingProfile(true)
    try {
      const saved = await updateCandidateProfile(toCandidateProfilePayload(profileValues))
      // Links come back normalized ("linkedin.com/in/x" -> "https://linkedin.com/in/x").
      setProfileValues({
        ...profileValues,
        linkedin_url: saved.linkedin_url ?? '',
        portfolio_url: saved.portfolio_url ?? '',
        resume_url: saved.resume_url ?? '',
      })
      setProfileSuccess('Perfil salvo com sucesso.')
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Não foi possível salvar seu perfil.')
    } finally {
      setIsSavingProfile(false)
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
          setError(err instanceof Error ? err.message : 'Não foi possível carregar as vagas.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    getCandidateProfile()
      .then((profile) => {
        if (isMounted) {
          setProfileValues({
            full_name: profile.full_name ?? '',
            phone: profile.phone ?? '',
            city: profile.city ?? '',
            state: profile.state ?? '',
            desired_role: profile.desired_role ?? '',
            professional_summary: profile.professional_summary ?? '',
            skills: profile.skills ?? '',
            experience_years: profile.experience_years?.toString() ?? '',
            salary_expectation: profile.salary_expectation?.toString() ?? '',
            work_mode: profile.work_mode ?? '',
            linkedin_url: profile.linkedin_url ?? '',
            portfolio_url: profile.portfolio_url ?? '',
            resume_url: profile.resume_url ?? '',
          })
          setProfileEmail(profile.email ?? '')
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setProfileError(err instanceof Error ? err.message : 'Não foi possível carregar seu perfil.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingProfile(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [setProfileValues])

  return (
    <DashboardShell active="candidate">
        <PageHeader
          eyebrow="Portal do candidato"
          title="Vagas abertas para você."
          description={`${user?.name ? `${user.name}, ` : ''}encontre oportunidades, melhore seu perfil e envie candidaturas pela AK Talent.`}
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

        <div className="mt-8 grid gap-3">
          {error ? (
            <Alert tone="error">{error}</Alert>
          ) : null}
          {success ? (
            <Alert tone="success">{success}</Alert>
          ) : null}
        </div>

        <div id="candidaturas" className="mt-8 scroll-mt-28">
          <MyApplicationsSection refreshKey={applicationsRefreshKey} />
        </div>

        <Card id="perfil" className="mt-10 scroll-mt-28 p-6">
        <form onSubmit={handleProfileSubmit} noValidate className="grid gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-brand-700">Meu Perfil</p>
            <h2 className="mt-2 text-2xl font-black text-ink-950">Complete seu perfil para melhorar o match.</h2>
            <p className="mt-2 text-sm leading-6 text-ink-600">
              Esses dados ajudam a equipe AK Talent a encontrar as vagas certas para você. Só nome, telefone e cidade são
              obrigatórios.
            </p>
          </div>

          {isLoadingProfile ? (
            <LoadingSpinner label="Carregando perfil..." />
          ) : null}
          {profileError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {profileError}
            </div>
          ) : null}
          {profileSuccess ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              {profileSuccess}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              id="profile_full_name"
              label="Nome completo"
              value={profileValues.full_name}
              placeholder="João Silva"
              autoComplete="name"
              error={profileErrors.full_name}
              onChange={(value) => changeProfileField('full_name', value)}
            />
            <Input id="profile_email" label="E-mail (da sua conta)" value={profileEmail} readOnly className="bg-slate-50 text-ink-600" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              id="profile_phone"
              label="Telefone ou WhatsApp"
              type="tel"
              inputMode="tel"
              value={profileValues.phone}
              placeholder="(41) 99999-9999"
              autoComplete="tel"
              error={profileErrors.phone}
              onChange={(value) => changeProfileField('phone', value)}
            />
            <FormField
              id="profile_city"
              label="Cidade"
              value={profileValues.city}
              placeholder="Curitiba"
              autoComplete="address-level2"
              error={profileErrors.city}
              onChange={(value) => changeProfileField('city', value)}
            />
            <FormField
              id="profile_state"
              label="Estado (opcional)"
              value={profileValues.state}
              placeholder="PR"
              required={false}
              onChange={(value) => changeProfileField('state', value)}
            />
          </div>

          <FormField
            id="profile_desired_role"
            label="Cargo desejado (opcional)"
            value={profileValues.desired_role}
            placeholder="Atendente, auxiliar administrativo…"
            required={false}
            onChange={(value) => changeProfileField('desired_role', value)}
          />

          <label htmlFor="profile_summary" className="grid gap-2 text-sm font-bold text-ink-800">
            Resumo profissional (opcional)
            <textarea
              id="profile_summary"
              value={profileValues.professional_summary}
              placeholder="Resumo da sua experiência, objetivos e diferenciais"
              onChange={(event) => changeProfileField('professional_summary', event.target.value)}
              rows={4}
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-medium text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-brand-600 focus:ring-4 focus:ring-teal-100"
            />
          </label>

          <label htmlFor="profile_skills" className="grid gap-2 text-sm font-bold text-ink-800">
            Habilidades (opcional)
            <textarea
              id="profile_skills"
              value={profileValues.skills}
              placeholder="Atendimento ao cliente, caixa, Excel"
              onChange={(event) => changeProfileField('skills', event.target.value)}
              rows={3}
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-medium text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-brand-600 focus:ring-4 focus:ring-teal-100"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              id="profile_experience"
              label="Anos de experiência (opcional)"
              inputMode="decimal"
              value={profileValues.experience_years}
              placeholder="2"
              required={false}
              error={profileErrors.experience_years}
              onChange={(value) => changeProfileField('experience_years', value)}
            />
            <FormField
              id="profile_salary"
              label="Pretensão salarial (opcional)"
              inputMode="decimal"
              value={profileValues.salary_expectation}
              placeholder="2500"
              required={false}
              error={profileErrors.salary_expectation}
              onChange={(value) => changeProfileField('salary_expectation', value)}
            />
            <label htmlFor="profile_work_mode" className="grid gap-2 text-sm font-bold text-ink-800">
              Modelo de trabalho (opcional)
              <select
                id="profile_work_mode"
                value={profileValues.work_mode}
                onChange={(event) => changeProfileField('work_mode', event.target.value)}
                className="h-12 rounded-lg border border-slate-300 bg-white px-4 text-base font-medium text-ink-950 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-teal-100"
              >
                <option value="">Prefiro não informar</option>
                <option value="remote">Remoto</option>
                <option value="hybrid">Híbrido</option>
                <option value="onsite">Presencial</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              id="profile_linkedin"
              label="LinkedIn (opcional)"
              inputMode="url"
              value={profileValues.linkedin_url}
              placeholder="linkedin.com/in/seu-perfil"
              required={false}
              error={profileErrors.linkedin_url}
              onChange={(value) => changeProfileField('linkedin_url', value)}
            />
            <FormField
              id="profile_portfolio"
              label="Portfólio (opcional)"
              inputMode="url"
              value={profileValues.portfolio_url}
              placeholder="seusite.com.br"
              required={false}
              error={profileErrors.portfolio_url}
              onChange={(value) => changeProfileField('portfolio_url', value)}
            />
            <FormField
              id="profile_resume"
              label="Currículo, link (opcional)"
              inputMode="url"
              value={profileValues.resume_url}
              placeholder="Link do Google Drive ou Dropbox"
              required={false}
              error={profileErrors.resume_url}
              onChange={(value) => changeProfileField('resume_url', value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSavingProfile}
            className="h-12 rounded-lg bg-brand-700 px-6 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSavingProfile ? 'Salvando perfil...' : 'Salvar perfil'}
          </button>
        </form>
        </Card>

        {aiAvailable ? (
        <Card className="mt-8 p-6">
        <form onSubmit={handleCareerAI} className="grid gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-brand-700">Career AI</p>
            <h2 className="mt-2 text-2xl font-black text-ink-950">Monte seu perfil profissional com IA.</h2>
            <p className="mt-2 text-sm leading-6 text-ink-600">
              Informe sua trajetória e receba um resumo, habilidades organizadas e melhorias sugeridas.
            </p>
          </div>

          {careerAIError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {careerAIError}
            </div>
          ) : null}
          {careerAISuccess ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              {careerAISuccess}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              id="desired_role"
              label="Cargo desejado"
              value={aiValues.desired_role}
              placeholder="Analista de Dados"
              onChange={(value) => updateAIField('desired_role', value)}
            />
            <FormField
              id="candidate_city"
              label="Cidade"
              value={aiValues.city}
              placeholder="São Paulo, SP"
              onChange={(value) => updateAIField('city', value)}
            />
          </div>

          <label htmlFor="experience" className="grid gap-2 text-sm font-bold text-ink-800">
            Experiência
            <textarea
              id="experience"
              value={aiValues.experience}
              placeholder="Conte sua experiência, setores, projetos e responsabilidades"
              onChange={(event) => updateAIField('experience', event.target.value)}
              required
              rows={4}
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-medium text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-brand-600 focus:ring-4 focus:ring-teal-100"
            />
          </label>

          <label htmlFor="skills" className="grid gap-2 text-sm font-bold text-ink-800">
            Habilidades
            <textarea
              id="skills"
              value={aiValues.skills}
              placeholder="Liste ferramentas, conhecimentos técnicos e soft skills"
              onChange={(event) => updateAIField('skills', event.target.value)}
              required
              rows={3}
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-medium text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-brand-600 focus:ring-4 focus:ring-teal-100"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label htmlFor="candidate_work_mode" className="grid gap-2 text-sm font-bold text-ink-800">
              Modelo de trabalho
              <select
                id="candidate_work_mode"
                value={aiValues.work_mode}
                onChange={(event) => updateAIField('work_mode', event.target.value)}
                className="h-12 rounded-lg border border-slate-300 bg-white px-4 text-base font-medium text-ink-950 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-teal-100"
              >
                <option value="remote">Remoto</option>
                <option value="hybrid">Híbrido</option>
                <option value="onsite">Presencial</option>
              </select>
            </label>
            <FormField
              id="salary_expectation"
              label="Pretensão salarial"
              value={aiValues.salary_expectation}
              placeholder="R$ 8.000"
              onChange={(value) => updateAIField('salary_expectation', value)}
            />
          </div>

          <button
            type="submit"
            disabled={isGeneratingProfile}
            className="h-12 rounded-lg bg-ink-950 px-6 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isGeneratingProfile ? 'Gerando perfil...' : 'Gerar perfil com IA'}
          </button>

          {careerAIResult ? (
            <div className="grid gap-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
              <div>
                <h3 className="text-lg font-black text-ink-950">Resumo profissional</h3>
                <p className="mt-2 text-sm leading-6 text-ink-700">{careerAIResult.professional_summary}</p>
              </div>
              <AIResultList title="Habilidades organizadas" items={careerAIResult.organized_skills} />
              <AIResultList title="Cargos sugeridos" items={careerAIResult.suggested_roles} />
              <AIResultList title="Melhorias no perfil" items={careerAIResult.profile_improvements} />
            </div>
          ) : null}
        </form>
        </Card>
        ) : (
          <AiComingSoon
            className="mt-8"
            eyebrow="Perfil com IA"
            title="Monte seu perfil profissional com IA."
            description="Em breve, a IA vai organizar seu resumo, suas habilidades e sugerir melhorias no perfil."
          />
        )}

        <div id="vagas" className="mt-10 grid scroll-mt-28 gap-4">
          {isLoading ? (
            <Card className="p-6"><LoadingSpinner label="Carregando vagas..." /></Card>
          ) : null}

          {!isLoading && jobs.length === 0 ? (
            <EmptyState title="Nenhuma vaga publicada ainda." description="Volte em breve para conferir oportunidades aprovadas." />
          ) : null}

          {jobs.map((job) => (
            <Card key={job.id} className="p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-brand-700">
                    {formatWorkMode(job.work_mode) || 'Modelo não informado'}
                  </p>
                  <h2 className="mt-3 text-2xl font-black text-ink-950">{job.title}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-600">{job.description}</p>
                  {job.requirements ? (
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-700">
                      <span className="font-black">Requisitos:</span> {job.requirements}
                    </p>
                  ) : null}
                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em] text-ink-600">
                    <span className="rounded-lg bg-slate-100 px-3 py-2">{job.location || 'Local não informado'}</span>
                    <span className="rounded-lg bg-slate-100 px-3 py-2">{formatSalary(job)}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  isLoading={applyingJobId === job.id}
                  disabled={applyingJobId === job.id}
                  onClick={() => void handleApply(job.id)}
                  className="shrink-0"
                >
                  Candidatar-se
                </Button>
              </div>
            </Card>
          ))}
        </div>
    </DashboardShell>
  )
}
