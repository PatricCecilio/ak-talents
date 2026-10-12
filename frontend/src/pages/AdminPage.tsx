import { useEffect, useState } from 'react'
import { CompanyForm } from '../components/admin/CompanyForm'
import { JobForm } from '../components/admin/JobForm'
import { RecruiterTeamSection } from '../components/admin/RecruiterTeamSection'
import { Alert, Badge, Button, Card, EmptyState, LoadingSpinner, PageHeader, Select } from '../components/ui'
import { DashboardShell } from '../layouts/DashboardShell'
import {
  approveCompany,
  approveJob,
  blockCompany,
  deleteAdminJob,
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
  setJobArchived,
  updateJobScreeningQuestions,
} from '../services/adminService'
import {
  JOB_STATUS_OPTIONS,
  deleteJobConfirmation,
  filterJobs,
  formatCnpj,
  formatPhone,
  jobRemovalAction,
  normalizeJobStatus,
  type JobStatusValue,
} from '../services/adminForms'
import { logout } from '../services/authService'
import { isCompanyPortalEnabled } from '../services/companyPortal'
import { formatCompanyStatus, formatJobStatus, formatOpenings } from '../services/jobFormat'
import { STAFF_LOGIN_PATH } from '../services/loginDoors'
import { formatScreeningStatus, whatsappLink } from '../services/pipelineFormat'
import type { AdminApplication, AdminCandidate, AdminCompany, AdminJob, AdminUser } from '../types/user'

function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone = status === 'archived' ? 'hidden' : status
  return <Badge status={tone as 'draft' | 'pending' | 'approved' | 'blocked' | 'hidden' | 'closed'}>{label}</Badge>
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
  // Which form is open: 'new', the id being edited, or none.
  const [companyForm, setCompanyForm] = useState<'new' | number | null>(null)
  const [jobForm, setJobForm] = useState<'new' | number | null>(null)
  const [jobStatusFilter, setJobStatusFilter] = useState<JobStatusValue | ''>('')
  const [jobCompanyFilter, setJobCompanyFilter] = useState('')
  const [showArchivedJobs, setShowArchivedJobs] = useState(false)
  // Job waiting for the "Excluir a vaga X?" confirmation.
  const [confirmDeleteJobId, setConfirmDeleteJobId] = useState<number | null>(null)
  // Old self-service portal (approve/block company accounts): only with VITE_COMPANY_PORTAL_ENABLED.
  const companyPortal = isCompanyPortalEnabled()
  const visibleJobs = filterJobs(jobs, jobStatusFilter, jobCompanyFilter)

  async function refreshAdminData(includeHidden = showHiddenApplications, includeArchived = showArchivedJobs) {
    const [usersData, candidatesData, companiesData, jobsData, applicationsData] = await Promise.all([
      getAdminUsers(),
      getAdminCandidates(),
      getAdminCompanies(),
      getAdminJobs(includeArchived),
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
          description="Cadastre as empresas clientes, abra as vagas e acompanhe candidatos e candidaturas."
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-ink-950">Empresas</h2>
              {companyForm === null ? (
                <Button type="button" onClick={() => setCompanyForm('new')}>
                  Nova empresa
                </Button>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-ink-600">Clientes da AK. Eles não entram no sistema: os relatórios vão pelo WhatsApp.</p>
            <div className="mt-5 grid gap-3">
              {companyForm === 'new' ? (
                <CompanyForm
                  onCancel={() => setCompanyForm(null)}
                  onSaved={(saved) => {
                    setCompanyForm(null)
                    setSuccess(`Empresa ${saved.company_name} cadastrada.`)
                    void refreshAdminData()
                  }}
                />
              ) : null}
              {companies.length === 0 && companyForm !== 'new' ? <EmptyState title="Nenhuma empresa cadastrada." /> : null}
              {companies.map((company) =>
                companyForm === company.id ? (
                  <CompanyForm
                    key={company.id}
                    company={company}
                    onCancel={() => setCompanyForm(null)}
                    onSaved={(saved) => {
                      setCompanyForm(null)
                      setSuccess(`Empresa ${saved.company_name} atualizada.`)
                      void refreshAdminData()
                    }}
                  />
                ) : (
                  <article key={company.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <h3 className="font-black text-ink-950">
                          {company.company_name}
                          {company.is_active === false ? <span className="ml-2 text-sm font-bold text-red-700">(desativada)</span> : null}
                        </h3>
                        <p className="mt-1 text-sm text-ink-600">
                          {[company.responsible_name, [company.city, company.state].filter(Boolean).join('/')].filter(Boolean).join(' · ') ||
                            'Responsável e cidade não informados'}
                        </p>
                        {company.whatsapp ? (
                          <a
                            href={whatsappLink(company.whatsapp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-sm font-bold text-brand-700 underline underline-offset-2"
                          >
                            WhatsApp {formatPhone(company.whatsapp)}
                          </a>
                        ) : null}
                        <p className="mt-1 text-sm text-ink-600">
                          {[company.cnpj ? `CNPJ ${formatCnpj(company.cnpj)}` : '', company.contact_email ?? '', `${company.jobs_count ?? 0} ${company.jobs_count === 1 ? 'vaga' : 'vagas'}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {company.notes ? <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{company.notes}</p> : null}
                        {company.has_account ? (
                          <p className="mt-1 text-xs text-ink-500">Tinha conta no portal antigo ({company.email}). O login está desligado.</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {companyPortal ? (
                          <>
                            <StatusBadge status={company.status} label={formatCompanyStatus(company.status)} />
                            <Button
                              type="button"
                              isLoading={actionId === `company-approve-${company.id}`}
                              disabled={actionId === `company-approve-${company.id}`}
                              onClick={() =>
                                void runAction(`company-approve-${company.id}`, () => approveCompany(company.id), 'Empresa aprovada.')
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
                          </>
                        ) : null}
                        <Button type="button" variant="secondary" onClick={() => setCompanyForm(company.id)}>
                          Editar
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
                ),
              )}
            </div>
          </Card>

          <Card id="vagas" className="scroll-mt-28 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-ink-950">Vagas</h2>
              {jobForm === null ? (
                <Button type="button" onClick={() => setJobForm('new')} disabled={!companies.some((company) => company.is_active !== false)}>
                  Nova vaga
                </Button>
              ) : null}
            </div>
            {!companies.some((company) => company.is_active !== false) ? (
              <p className="mt-2 text-sm text-ink-600">Cadastre uma empresa antes de abrir a primeira vaga.</p>
            ) : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Select
                id="job-status-filter"
                label="Status"
                value={jobStatusFilter}
                onChange={(event) => setJobStatusFilter(event.target.value as JobStatusValue | '')}
              >
                <option value="">Todos</option>
                {JOB_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select id="job-company-filter" label="Empresa" value={jobCompanyFilter} onChange={(event) => setJobCompanyFilter(event.target.value)}>
                <option value="">Todas</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.company_name}
                  </option>
                ))}
              </Select>
            </div>
            <label className="mt-3 flex w-fit items-center gap-2 text-sm font-semibold text-ink-700">
              <input
                type="checkbox"
                checked={showArchivedJobs}
                onChange={(event) => {
                  setShowArchivedJobs(event.target.checked)
                  void refreshAdminData(showHiddenApplications, event.target.checked)
                }}
                className="h-4 w-4"
              />
              Mostrar arquivadas
            </label>
            <div className="mt-5 grid gap-3">
              {jobForm === 'new' ? (
                <JobForm
                  companies={companies}
                  onCancel={() => setJobForm(null)}
                  onSaved={(saved) => {
                    setJobForm(null)
                    setSuccess(`Vaga ${saved.title} criada (${formatJobStatus(saved.status).toLowerCase()}).`)
                    void refreshAdminData()
                  }}
                />
              ) : null}
              {visibleJobs.length === 0 && jobForm !== 'new' ? (
                <EmptyState title={jobs.length === 0 ? 'Nenhuma vaga cadastrada.' : 'Nenhuma vaga com esses filtros.'} />
              ) : null}
              {visibleJobs.map((job) =>
                jobForm === job.id ? (
                  <JobForm
                    key={job.id}
                    jobId={job.id}
                    companies={companies}
                    onCancel={() => setJobForm(null)}
                    onSaved={(saved) => {
                      setJobForm(null)
                      setSuccess(`Vaga ${saved.title} salva.`)
                      void refreshAdminData()
                    }}
                  />
                ) : (
                <article key={job.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-black text-ink-950">{job.title}</h3>
                      <p className="mt-1 text-sm text-ink-600">
                        {job.company_name}
                        {job.company_is_active === false ? <span className="ml-1 font-bold text-red-700">(empresa desativada)</span> : null}
                      </p>
                      <p className="mt-1 text-sm text-ink-600">
                        {[job.location || 'Local não informado', formatOpenings(job.openings)].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-1 text-sm text-ink-600">
                        Responsável: {job.recruiter_name ?? 'ninguém'} ·{' '}
                        {job.applications_count === 1 ? '1 candidatura' : `${job.applications_count ?? 0} candidaturas`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={job.status === 'archived' ? 'archived' : normalizeJobStatus(job.status)} label={formatJobStatus(job.status)} />
                      {jobRemovalAction(job) === 'unarchive' ? (
                        <Button
                          type="button"
                          variant="secondary"
                          isLoading={actionId === `job-unarchive-${job.id}`}
                          disabled={actionId === `job-unarchive-${job.id}`}
                          onClick={() =>
                            void runAction(
                              `job-unarchive-${job.id}`,
                              () => setJobArchived(job.id, false),
                              'Vaga desarquivada. Ela volta como Encerrada; publique de novo se quiser.',
                            )
                          }
                        >
                          Desarquivar
                        </Button>
                      ) : (
                        <>
                      <Button type="button" variant="secondary" onClick={() => setJobForm(job.id)}>
                        Editar
                      </Button>
                      {normalizeJobStatus(job.status) !== 'approved' ? (
                        <Button
                          type="button"
                          isLoading={actionId === `job-approve-${job.id}`}
                          disabled={actionId === `job-approve-${job.id}`}
                          onClick={() => void runAction(`job-approve-${job.id}`, () => approveJob(job.id), 'Vaga publicada no site.')}
                        >
                          Publicar
                        </Button>
                      ) : null}
                      {normalizeJobStatus(job.status) !== 'closed' ? (
                        <Button
                          type="button"
                          variant="secondary"
                          isLoading={actionId === `job-hide-${job.id}`}
                          disabled={actionId === `job-hide-${job.id}`}
                          onClick={() => void runAction(`job-hide-${job.id}`, () => hideJob(job.id), 'Vaga encerrada (saiu do site).')}
                        >
                          Encerrar
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        isLoading={actionId === `screening-load-${job.id}`}
                        onClick={() => void loadScreeningConfig(job.id)}
                      >
                        Triagem
                      </Button>
                      {jobRemovalAction(job) === 'delete' ? (
                        <Button type="button" variant="danger" onClick={() => setConfirmDeleteJobId(job.id)}>
                          Excluir
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          isLoading={actionId === `job-archive-${job.id}`}
                          disabled={actionId === `job-archive-${job.id}`}
                          onClick={() =>
                            void runAction(
                              `job-archive-${job.id}`,
                              () => setJobArchived(job.id, true),
                              'Vaga arquivada: saiu das listas e do site. As candidaturas e o histórico continuam guardados.',
                            )
                          }
                        >
                          Arquivar
                        </Button>
                      )}
                        </>
                      )}
                    </div>
                  </div>
                  {confirmDeleteJobId === job.id ? (
                    <div role="alertdialog" aria-label="Confirmar exclusão" className="mt-4 grid gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                      <p className="text-sm font-bold text-red-800">{deleteJobConfirmation(job.title)}</p>
                      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="secondary" onClick={() => setConfirmDeleteJobId(null)}>
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          isLoading={actionId === `job-delete-${job.id}`}
                          disabled={actionId === `job-delete-${job.id}`}
                          onClick={() => {
                            setConfirmDeleteJobId(null)
                            void runAction(`job-delete-${job.id}`, () => deleteAdminJob(job.id), `Vaga ${job.title} excluída.`)
                          }}
                        >
                          Sim, excluir
                        </Button>
                      </div>
                    </div>
                  ) : null}
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
                ),
              )}
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
