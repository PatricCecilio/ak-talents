import { useEffect, useState } from 'react'
import { RecruiterTeamSection } from '../components/admin/RecruiterTeamSection'
import { Alert, Badge, Button, Card, EmptyState, LoadingSpinner, PageHeader } from '../components/ui'
import { DashboardShell } from '../layouts/DashboardShell'
import {
  approveCompany,
  approveJob,
  blockCompany,
  getAdminApplications,
  getAdminCandidates,
  getAdminCompanies,
  getAdminJobs,
  getAdminUsers,
  getJobScreeningQuestions,
  hideJob,
  setApplicationHidden,
  setCandidateActive,
  setCompanyActive,
  updateJobScreeningQuestions,
} from '../services/adminService'
import { logout } from '../services/authService'
import { formatCompanyStatus, formatJobStatus } from '../services/jobFormat'
import { STAFF_LOGIN_PATH } from '../services/loginDoors'
import { formatScreeningStatus } from '../services/pipelineFormat'
import type { AdminApplication, AdminCandidate, AdminCompany, AdminJob, AdminUser } from '../types/user'

function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge status={status as 'pending' | 'approved' | 'blocked' | 'hidden' | 'closed'}>{label}</Badge>
}

export function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [candidates, setCandidates] = useState<AdminCandidate[]>([])
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [applications, setApplications] = useState<AdminApplication[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [screeningConfigByJobId, setScreeningConfigByJobId] = useState<Record<number, string>>({})
  const [openScreeningJobId, setOpenScreeningJobId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showHiddenApplications, setShowHiddenApplications] = useState(false)

  async function refreshAdminData(includeHidden = showHiddenApplications) {
    const [usersData, candidatesData, companiesData, jobsData, applicationsData] = await Promise.all([
      getAdminUsers(),
      getAdminCandidates(),
      getAdminCompanies(),
      getAdminJobs(),
      getAdminApplications(includeHidden),
    ])

    setUsers(usersData)
    setCandidates(candidatesData)
    setCompanies(companiesData)
    setJobs(jobsData)
    setApplications(applicationsData)
  }

  async function runAction(actionKey: string, action: () => Promise<unknown>, message: string) {
    setActionId(actionKey)
    setError('')
    setSuccess('')

    try {
      await action()
      await refreshAdminData()
      setSuccess(message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível executar a ação.')
    } finally {
      setActionId(null)
    }
  }

  async function loadScreeningConfig(jobId: number) {
    setActionId(`screening-load-${jobId}`)
    setError('')
    try {
      const questions = await getJobScreeningQuestions(jobId)
      setScreeningConfigByJobId((currentValues) => ({
        ...currentValues,
        [jobId]: JSON.stringify(
          questions.map((question) => {
            const editableQuestion: Record<string, unknown> = { ...question }
            delete editableQuestion.id
            delete editableQuestion.job_id
            delete editableQuestion.created_at
            return editableQuestion
          }),
          null,
          2,
        ),
      }))
      setOpenScreeningJobId(jobId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a triagem.')
    } finally {
      setActionId(null)
    }
  }

  async function saveScreeningConfig(jobId: number) {
    setActionId(`screening-save-${jobId}`)
    setError('')
    setSuccess('')
    try {
      const parsed = JSON.parse(screeningConfigByJobId[jobId] || '[]') as unknown
      if (!Array.isArray(parsed)) {
        throw new Error('A configuração precisa ser uma lista JSON de perguntas.')
      }
      await updateJobScreeningQuestions(jobId, parsed)
      setSuccess('Triagem salva para a vaga.')
      await refreshAdminData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a triagem.')
    } finally {
      setActionId(null)
    }
  }

  useEffect(() => {
    let isMounted = true

    Promise.all([
      getAdminUsers(),
      getAdminCandidates(),
      getAdminCompanies(),
      getAdminJobs(),
      getAdminApplications(),
    ])
      .then(([usersData, candidatesData, companiesData, jobsData, applicationsData]) => {
        if (isMounted) {
          setUsers(usersData)
          setCandidates(candidatesData)
          setCompanies(companiesData)
          setJobs(jobsData)
          setApplications(applicationsData)
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Não foi possível carregar o painel admin.')
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

  const summaries = [
    { label: 'Usuários', value: users.length },
    { label: 'Empresas', value: companies.length },
    { label: 'Candidatos', value: candidates.length },
    { label: 'Vagas', value: jobs.length },
    { label: 'Candidaturas', value: applications.length },
  ]

  return (
    <DashboardShell active="admin">
        <PageHeader
          eyebrow="Painel Admin"
          title="Controle interno AK Talent."
          description="Gerencie empresas, vagas, candidatos, usuários e candidaturas da plataforma."
          action={
            <Button
            type="button"
              variant="secondary"
            onClick={() => {
              logout()
              window.location.href = STAFF_LOGIN_PATH
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

        <div id="resumo" className="mt-10 grid scroll-mt-28 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {summaries.map((summary) => (
            <Card key={summary.label} className="p-5">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-ink-400">{summary.label}</p>
              <p className="mt-3 text-3xl font-black text-ink-950">{summary.value}</p>
            </Card>
          ))}
        </div>

        <div className="mt-10">
          <RecruiterTeamSection />
        </div>

        {isLoading ? (
          <Card className="mt-10 p-6"><LoadingSpinner label="Carregando painel admin..." /></Card>
        ) : null}

        <div className="mt-10 grid gap-8">
          <Card id="empresas" className="scroll-mt-28 p-6">
            <h2 className="text-2xl font-black text-ink-950">Empresas</h2>
            <div className="mt-5 grid gap-3">
              {companies.length === 0 ? <EmptyState title="Nenhuma empresa cadastrada." /> : null}
              {companies.map((company) => (
                <article key={company.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-black text-ink-950">
                        {company.company_name}
                        {company.is_active === false ? <span className="ml-2 text-sm font-bold text-red-700">(desativada)</span> : null}
                      </h3>
                      <p className="mt-1 text-sm text-ink-600">{company.email}</p>
                      <p className="mt-1 text-sm text-ink-600">{company.city || 'Cidade não informada'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={company.status} label={formatCompanyStatus(company.status)} />
                      <Button
                        type="button"
                        isLoading={actionId === `company-approve-${company.id}`}
                        disabled={actionId === `company-approve-${company.id}`}
                        onClick={() =>
                          void runAction(
                            `company-approve-${company.id}`,
                            () => approveCompany(company.id),
                            'Empresa aprovada.',
                          )
                        }
                      >
                        Aprovar
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        isLoading={actionId === `company-block-${company.id}`}
                        disabled={actionId === `company-block-${company.id}`}
                        onClick={() =>
                          void runAction(`company-block-${company.id}`, () => blockCompany(company.id), 'Empresa bloqueada.')
                        }
                      >
                        Bloquear
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        isLoading={actionId === `company-active-${company.id}`}
                        disabled={actionId === `company-active-${company.id}`}
                        onClick={() =>
                          void runAction(
                            `company-active-${company.id}`,
                            () => setCompanyActive(company.id, company.is_active === false),
                            company.is_active === false ? 'Empresa reativada.' : 'Empresa desativada (nada foi apagado).',
                          )
                        }
                      >
                        {company.is_active === false ? 'Reativar' : 'Desativar'}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Card>

          <Card id="vagas" className="scroll-mt-28 p-6">
            <h2 className="text-2xl font-black text-ink-950">Vagas</h2>
            <div className="mt-5 grid gap-3">
              {jobs.length === 0 ? <EmptyState title="Nenhuma vaga cadastrada." /> : null}
              {jobs.map((job) => (
                <article key={job.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-black text-ink-950">{job.title}</h3>
                      <p className="mt-1 text-sm text-ink-600">{job.company_name}</p>
                      <p className="mt-1 text-sm text-ink-600">{job.location || 'Local não informado'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={job.status} label={formatJobStatus(job.status)} />
                      <Button
                        type="button"
                        isLoading={actionId === `job-approve-${job.id}`}
                        disabled={actionId === `job-approve-${job.id}`}
                        onClick={() => void runAction(`job-approve-${job.id}`, () => approveJob(job.id), 'Vaga aprovada.')}
                      >
                        Aprovar
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        isLoading={actionId === `job-hide-${job.id}`}
                        disabled={actionId === `job-hide-${job.id}`}
                        onClick={() => void runAction(`job-hide-${job.id}`, () => hideJob(job.id), 'Vaga ocultada.')}
                      >
                        Ocultar
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        isLoading={actionId === `screening-load-${job.id}`}
                        onClick={() => void loadScreeningConfig(job.id)}
                      >
                        Triagem
                      </Button>
                    </div>
                  </div>
                  {openScreeningJobId === job.id ? (
                    <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5">
                      <p className="text-sm font-bold text-ink-700">
                        Configure a triagem como uma lista JSON de perguntas usando YES_NO, SINGLE_SELECT ou TEXT.
                      </p>
                      <textarea
                        value={screeningConfigByJobId[job.id] || '[]'}
                        onChange={(event) =>
                          setScreeningConfigByJobId((currentValues) => ({
                            ...currentValues,
                            [job.id]: event.target.value,
                          }))
                        }
                        rows={12}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-mono text-sm text-ink-950 outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-amber-100"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          isLoading={actionId === `screening-save-${job.id}`}
                          onClick={() => void saveScreeningConfig(job.id)}
                        >
                          Salvar triagem
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setOpenScreeningJobId(null)}>
                          Fechar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </Card>

          <Card id="candidatos" className="scroll-mt-28 p-6">
            <h2 className="text-2xl font-black text-ink-950">Candidatos</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {candidates.length === 0 ? <EmptyState title="Nenhum candidato cadastrado." /> : null}
              {candidates.map((candidate) => (
                <article key={candidate.id} className="rounded-lg border border-slate-200 p-4">
                  <h3 className="font-black text-ink-950">{candidate.name}</h3>
                  <p className="mt-1 text-sm text-ink-600">{candidate.email || 'E-mail não informado'}</p>
                  <p className="mt-1 text-sm text-ink-600">{candidate.phone || 'Telefone não informado'}</p>
                  <p className="mt-1 text-sm text-ink-600">
                    {[candidate.city, candidate.neighborhood].filter(Boolean).join(' / ') || 'Localização não informada'}
                  </p>
                  <p className="mt-1 text-sm text-ink-600">{candidate.desired_role || 'Cargo não informado'}</p>
                  {candidate.is_active === false ? <p className="mt-1 text-sm font-bold text-red-700">Desativado</p> : null}
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-3"
                    isLoading={actionId === `candidate-active-${candidate.id}`}
                    disabled={actionId === `candidate-active-${candidate.id}`}
                    onClick={() =>
                      void runAction(
                        `candidate-active-${candidate.id}`,
                        () => setCandidateActive(candidate.id, candidate.is_active === false),
                        candidate.is_active === false
                          ? 'Candidato reativado e candidaturas visíveis novamente.'
                          : 'Candidato desativado e candidaturas ocultas (nada foi apagado).',
                      )
                    }
                  >
                    {candidate.is_active === false ? 'Reativar' : 'Desativar'}
                  </Button>
                </article>
              ))}
            </div>
          </Card>

          <Card id="candidaturas" className="scroll-mt-28 p-6">
            <h2 className="text-2xl font-black text-ink-950">Candidaturas</h2>
            <label className="mt-3 flex w-fit items-center gap-2 text-sm font-semibold text-ink-700">
              <input
                type="checkbox"
                checked={showHiddenApplications}
                onChange={(event) => {
                  setShowHiddenApplications(event.target.checked)
                  void refreshAdminData(event.target.checked)
                }}
                className="h-4 w-4"
              />
              Mostrar candidaturas ocultas
            </label>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {applications.length === 0 ? <EmptyState title="Nenhuma candidatura recebida." /> : null}
              {applications.map((application) => (
                <article key={application.id} className="rounded-lg border border-slate-200 p-4">
                  <h3 className="font-black text-ink-950">{application.candidate_name}</h3>
                  <p className="mt-1 text-sm text-ink-600">{application.job_title}</p>
                  <p className="mt-1 text-sm text-ink-600">{application.candidate_phone || 'Telefone não informado'}</p>
                  <p className="mt-1 text-sm text-ink-600">
                    {[application.candidate_city, application.candidate_neighborhood].filter(Boolean).join(' / ') ||
                      'Localização não informada'}
                  </p>
                  <p className="mt-1 text-sm font-bold text-ink-700">
                    Etapa: {application.stage_label ?? application.status}
                    {application.is_hidden ? <span className="ml-2 text-red-700">(oculta)</span> : null}
                  </p>
                  <p className="mt-1 text-sm font-bold text-brand-700">
                    Triagem: {formatScreeningStatus(application.screening_status)}
                    {application.screening_score !== null ? ` (${application.screening_score})` : ''}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-3"
                    isLoading={actionId === `application-hidden-${application.id}`}
                    disabled={actionId === `application-hidden-${application.id}`}
                    onClick={() =>
                      void runAction(
                        `application-hidden-${application.id}`,
                        () => setApplicationHidden(application.id, !application.is_hidden),
                        application.is_hidden ? 'Candidatura visível novamente.' : 'Candidatura ocultada das listas (nada foi apagado).',
                      )
                    }
                  >
                    {application.is_hidden ? 'Mostrar' : 'Ocultar'}
                  </Button>
                </article>
              ))}
            </div>
          </Card>
        </div>
    </DashboardShell>
  )
}
