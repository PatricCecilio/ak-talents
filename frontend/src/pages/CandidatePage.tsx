import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { AIResultList } from '../components/AIResultList'
import { FormField } from '../components/FormField'
import { Alert, Button, Card, EmptyState, LoadingSpinner, PageHeader } from '../components/ui'
import { useFormState } from '../hooks/useFormState'
import { DashboardShell } from '../layouts/DashboardShell'
import { createApplication } from '../services/applicationService'
import { generateCandidateProfile } from '../services/aiService'
import { getCurrentUser, logout } from '../services/authService'
import { getJobs } from '../services/jobService'
import { getCandidateProfile, updateCandidateProfile } from '../services/profileService'
import type { CandidateProfileAIResponse } from '../types/ai'
import type { Job } from '../types/user'

function formatSalary(job: Job) {
  if (job.salary_min && job.salary_max) {
    return `R$ ${job.salary_min.toLocaleString('pt-BR')} - R$ ${job.salary_max.toLocaleString('pt-BR')}`
  }

  if (job.salary_min) {
    return `A partir de R$ ${job.salary_min.toLocaleString('pt-BR')}`
  }

  if (job.salary_max) {
    return `Ate R$ ${job.salary_max.toLocaleString('pt-BR')}`
  }

  return 'Salario a combinar'
}

export function CandidatePage() {
  const user = getCurrentUser()
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
  const { values: profileValues, updateField: updateProfileField, setFormValues: setProfileValues } = useFormState({
    full_name: '',
    phone: '',
    city: '',
    state: '',
    desired_role: '',
    professional_summary: '',
    skills: '',
    experience_years: '',
    salary_expectation: '',
    work_mode: 'remote',
    linkedin_url: '',
    portfolio_url: '',
  })
  const { values: aiValues, updateField: updateAIField } = useFormState({
    desired_role: '',
    experience: '',
    skills: '',
    city: '',
    work_mode: 'remote',
    salary_expectation: '',
  })

  async function handleApply(jobId: number) {
    setApplyingJobId(jobId)
    setError('')
    setSuccess('')

    try {
      await createApplication({ job_id: jobId })
      setSuccess('Candidatura enviada com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel enviar a candidatura.')
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
      setCareerAIError(err instanceof Error ? err.message : 'Nao foi possivel gerar seu perfil com IA.')
    } finally {
      setIsGeneratingProfile(false)
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingProfile(true)
    setProfileError('')
    setProfileSuccess('')

    try {
      await updateCandidateProfile({
        full_name: profileValues.full_name,
        phone: profileValues.phone,
        city: profileValues.city,
        state: profileValues.state,
        desired_role: profileValues.desired_role,
        professional_summary: profileValues.professional_summary,
        skills: profileValues.skills,
        experience_years: profileValues.experience_years ? Number(profileValues.experience_years) : null,
        salary_expectation: profileValues.salary_expectation ? Number(profileValues.salary_expectation) : null,
        work_mode: profileValues.work_mode,
        linkedin_url: profileValues.linkedin_url,
        portfolio_url: profileValues.portfolio_url,
      })
      setProfileSuccess('Perfil salvo com sucesso.')
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Nao foi possivel salvar seu perfil.')
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
          setError(err instanceof Error ? err.message : 'Nao foi possivel carregar as vagas.')
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
            work_mode: profile.work_mode ?? 'remote',
            linkedin_url: profile.linkedin_url ?? '',
            portfolio_url: profile.portfolio_url ?? '',
          })
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setProfileError(err instanceof Error ? err.message : 'Nao foi possivel carregar seu perfil.')
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
          title="Vagas abertas para voce."
          description={`${user?.name ? `${user.name}, ` : ''}encontre oportunidades, melhore seu perfil e envie candidaturas pela AK Talents.`}
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

        <div className="mt-8 grid gap-3">
          {error ? (
            <Alert tone="error">{error}</Alert>
          ) : null}
          {success ? (
            <Alert tone="success">{success}</Alert>
          ) : null}
        </div>

        <Card className="mt-10 p-6">
        <form onSubmit={handleProfileSubmit} className="grid gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-brand-700">Meu Perfil</p>
            <h2 className="mt-2 text-2xl font-black text-ink-950">Complete seu perfil para melhorar o match.</h2>
            <p className="mt-2 text-sm leading-6 text-ink-600">
              Esses dados alimentam a compatibilidade com vagas e ajudam empresas a entender seu contexto.
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
              placeholder="Joao Silva"
              onChange={(value) => updateProfileField('full_name', value)}
            />
            <FormField
              id="profile_phone"
              label="Telefone"
              value={profileValues.phone}
              placeholder="(11) 99999-9999"
              onChange={(value) => updateProfileField('phone', value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              id="profile_city"
              label="Cidade"
              value={profileValues.city}
              placeholder="Sao Paulo"
              onChange={(value) => updateProfileField('city', value)}
            />
            <FormField
              id="profile_state"
              label="Estado"
              value={profileValues.state}
              placeholder="SP"
              onChange={(value) => updateProfileField('state', value)}
            />
            <FormField
              id="profile_desired_role"
              label="Cargo desejado"
              value={profileValues.desired_role}
              placeholder="Frontend Developer"
              onChange={(value) => updateProfileField('desired_role', value)}
            />
          </div>

          <label htmlFor="profile_summary" className="grid gap-2 text-sm font-bold text-ink-800">
            Resumo profissional
            <textarea
              id="profile_summary"
              value={profileValues.professional_summary}
              placeholder="Resumo da sua experiencia, objetivos e diferenciais"
              onChange={(event) => updateProfileField('professional_summary', event.target.value)}
              rows={4}
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-medium text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-brand-600 focus:ring-4 focus:ring-teal-100"
            />
          </label>

          <label htmlFor="profile_skills" className="grid gap-2 text-sm font-bold text-ink-800">
            Habilidades
            <textarea
              id="profile_skills"
              value={profileValues.skills}
              placeholder="React, TypeScript, SQL, Atendimento ao cliente"
              onChange={(event) => updateProfileField('skills', event.target.value)}
              rows={3}
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-medium text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-brand-600 focus:ring-4 focus:ring-teal-100"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              id="profile_experience"
              label="Anos de experiencia"
              type="number"
              value={profileValues.experience_years}
              placeholder="4"
              onChange={(value) => updateProfileField('experience_years', value)}
            />
            <FormField
              id="profile_salary"
              label="Pretensao salarial"
              type="number"
              value={profileValues.salary_expectation}
              placeholder="9000"
              onChange={(value) => updateProfileField('salary_expectation', value)}
            />
            <label htmlFor="profile_work_mode" className="grid gap-2 text-sm font-bold text-ink-800">
              Modelo de trabalho
              <select
                id="profile_work_mode"
                value={profileValues.work_mode}
                onChange={(event) => updateProfileField('work_mode', event.target.value)}
                className="h-12 rounded-lg border border-slate-300 bg-white px-4 text-base font-medium text-ink-950 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-teal-100"
              >
                <option value="remote">Remoto</option>
                <option value="hybrid">Hibrido</option>
                <option value="onsite">Presencial</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              id="profile_linkedin"
              label="LinkedIn"
              value={profileValues.linkedin_url}
              placeholder="https://linkedin.com/in/seu-perfil"
              onChange={(value) => updateProfileField('linkedin_url', value)}
            />
            <FormField
              id="profile_portfolio"
              label="Portfolio"
              value={profileValues.portfolio_url}
              placeholder="https://seusite.com"
              onChange={(value) => updateProfileField('portfolio_url', value)}
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

        <Card className="mt-8 p-6">
        <form onSubmit={handleCareerAI} className="grid gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-brand-700">Career AI</p>
            <h2 className="mt-2 text-2xl font-black text-ink-950">Monte seu perfil profissional com IA.</h2>
            <p className="mt-2 text-sm leading-6 text-ink-600">
              Informe sua trajetoria e receba um resumo, habilidades organizadas e melhorias sugeridas.
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
              placeholder="Sao Paulo, SP"
              onChange={(value) => updateAIField('city', value)}
            />
          </div>

          <label htmlFor="experience" className="grid gap-2 text-sm font-bold text-ink-800">
            Experiencia
            <textarea
              id="experience"
              value={aiValues.experience}
              placeholder="Conte sua experiencia, setores, projetos e responsabilidades"
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
              placeholder="Liste ferramentas, conhecimentos tecnicos e soft skills"
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
                <option value="hybrid">Hibrido</option>
                <option value="onsite">Presencial</option>
              </select>
            </label>
            <FormField
              id="salary_expectation"
              label="Pretensao salarial"
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

        <div className="mt-10 grid gap-4">
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
                    {job.work_mode || 'Modelo nao informado'}
                  </p>
                  <h2 className="mt-3 text-2xl font-black text-ink-950">{job.title}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-600">{job.description}</p>
                  {job.requirements ? (
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-700">
                      <span className="font-black">Requisitos:</span> {job.requirements}
                    </p>
                  ) : null}
                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em] text-ink-600">
                    <span className="rounded-lg bg-slate-100 px-3 py-2">{job.location || 'Local nao informado'}</span>
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
