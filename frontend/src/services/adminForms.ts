// Admin forms for client companies and their jobs: form values <-> API payloads. Pure functions, no runtime imports
// (the tests load this file directly). The API validates again and answers in Portuguese.
import type { CompanyPayload } from '../types/user'

export const JOB_STATUS_OPTIONS = [
  { value: 'draft', label: 'Rascunho', hint: 'Fora do site. Termine e publique quando quiser.' },
  { value: 'approved', label: 'Publicada', hint: 'Aparece em /vagas e recebe candidaturas.' },
  { value: 'closed', label: 'Encerrada', hint: 'Sai do site. O histórico continua.' },
] as const

export type JobStatusValue = (typeof JOB_STATUS_OPTIONS)[number]['value']

export const BRAZIL_UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ',
  'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const

const blankToNull = (value: string): string | null => value.trim() || null

const digits = (value: string): string => value.replace(/\D+/g, '')

// --- companies -----------------------------------------------------------------------------------------------------

export interface CompanyFormValues {
  company_name: string
  cnpj: string
  responsible_name: string
  whatsapp: string
  contact_email: string
  city: string
  state: string
  notes: string
}

export const EMPTY_COMPANY_FORM: CompanyFormValues = {
  company_name: '',
  cnpj: '',
  responsible_name: '',
  whatsapp: '',
  contact_email: '',
  city: '',
  state: '',
  notes: '',
}

interface CompanyLike {
  company_name: string
  cnpj?: string | null
  responsible_name: string | null
  whatsapp?: string | null
  contact_email?: string | null
  city: string | null
  state: string | null
  notes?: string | null
}

export function companyToForm(company: CompanyLike): CompanyFormValues {
  return {
    company_name: company.company_name,
    cnpj: company.cnpj ? formatCnpj(company.cnpj) : '',
    responsible_name: company.responsible_name ?? '',
    whatsapp: company.whatsapp ? formatPhone(company.whatsapp) : '',
    contact_email: company.contact_email ?? '',
    city: company.city ?? '',
    // Old portal companies may have the state's full name: only a valid UF fills the select.
    state: (BRAZIL_UFS as readonly string[]).includes((company.state ?? '').toUpperCase()) ? (company.state ?? '').toUpperCase() : '',
    notes: company.notes ?? '',
  }
}

/** Returns the payload or the first problem, in Portuguese (same rules as the API). */
export function companyFormToPayload(values: CompanyFormValues): { payload: CompanyPayload; error: '' } | { payload: null; error: string } {
  if (values.company_name.trim().length < 2) return { payload: null, error: 'Informe o nome da empresa.' }
  const cnpj = digits(values.cnpj)
  if (cnpj && cnpj.length !== 14) return { payload: null, error: 'Confira o CNPJ: são 14 números.' }
  const whatsapp = digits(values.whatsapp)
  if (whatsapp.length < 10 || whatsapp.length > 13) return { payload: null, error: 'Confira o WhatsApp: informe o DDD e o número.' }
  return {
    payload: {
      company_name: values.company_name.trim(),
      cnpj: cnpj || null,
      responsible_name: blankToNull(values.responsible_name),
      whatsapp,
      contact_email: blankToNull(values.contact_email),
      city: blankToNull(values.city),
      state: blankToNull(values.state),
      notes: blankToNull(values.notes),
    },
    error: '',
  }
}

export function formatCnpj(value: string): string {
  const d = digits(value)
  if (d.length !== 14) return value
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/** (41) 99999-0000 for Brazilian numbers (with or without the 55 country code); anything else as typed. */
export function formatPhone(value: string): string {
  let d = digits(value)
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return value
}

// --- jobs ----------------------------------------------------------------------------------------------------------

export interface JobFormValues {
  company_id: string
  title: string
  description: string
  requirements: string
  salary_min: string
  salary_max: string
  location: string
  work_mode: string
  schedule: string
  benefits: string
  contract_type: string
  openings: string
  recruiter_id: string
  status: JobStatusValue
}

export const EMPTY_JOB_FORM: JobFormValues = {
  company_id: '',
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
  recruiter_id: '',
  status: 'draft',
}

interface JobLike {
  company_id: number
  title: string
  description: string
  requirements: string | null
  salary_min: number | null
  salary_max: number | null
  location: string | null
  work_mode: string | null
  schedule?: string | null
  benefits?: string | null
  contract_type?: string | null
  openings?: number | null
  recruiter_id: number | null
  status: string
}

const optionalNumberText = (value: number | null | undefined): string => (value === null || value === undefined ? '' : String(value))

/** Old statuses from before migration 0014 read as the closest new one. */
export function normalizeJobStatus(status: string): JobStatusValue {
  if (status === 'approved') return 'approved'
  if (status === 'closed' || status === 'hidden') return 'closed'
  return 'draft'
}

export function jobToForm(job: JobLike): JobFormValues {
  return {
    company_id: String(job.company_id),
    title: job.title,
    description: job.description,
    requirements: job.requirements ?? '',
    salary_min: optionalNumberText(job.salary_min),
    salary_max: optionalNumberText(job.salary_max),
    location: job.location ?? '',
    work_mode: job.work_mode || 'onsite',
    schedule: job.schedule ?? '',
    benefits: job.benefits ?? '',
    contract_type: job.contract_type ?? '',
    openings: optionalNumberText(job.openings),
    recruiter_id: optionalNumberText(job.recruiter_id),
    status: normalizeJobStatus(job.status),
  }
}

function optionalNumber(value: string): number | null {
  const text = value.trim().replace(',', '.')
  if (!text) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

type ContractTypeValue = 'clt' | 'temporary' | 'internship' | 'pj'

export interface JobFormPayload {
  company_id: number
  title: string
  description: string
  requirements: string
  salary_min: number | null
  salary_max: number | null
  location: string
  work_mode: string
  schedule: string | null
  benefits: string | null
  contract_type: ContractTypeValue | null
  openings: number | null
  recruiter_id: number | null
  status: JobStatusValue
}

/** Returns the payload or the first problem, in Portuguese (same rules as the API). */
export function jobFormToPayload(values: JobFormValues): { payload: JobFormPayload; error: '' } | { payload: null; error: string } {
  if (!values.company_id) return { payload: null, error: 'Escolha a empresa da vaga.' }
  if (values.title.trim().length < 3) return { payload: null, error: 'Informe o título da vaga.' }
  if (values.description.trim().length < 10) return { payload: null, error: 'Descreva a vaga (pelo menos 10 caracteres).' }
  const salaryMin = optionalNumber(values.salary_min)
  const salaryMax = optionalNumber(values.salary_max)
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
    return { payload: null, error: 'O salário mínimo não pode ser maior que o salário máximo.' }
  }
  const openings = optionalNumber(values.openings)
  if (openings !== null && (!Number.isInteger(openings) || openings < 1 || openings > 999)) {
    return { payload: null, error: 'A quantidade de vagas deve ser um número de 1 a 999.' }
  }
  return {
    payload: {
      company_id: Number(values.company_id),
      title: values.title.trim(),
      description: values.description.trim(),
      requirements: values.requirements.trim(),
      salary_min: salaryMin,
      salary_max: salaryMax,
      location: values.location.trim(),
      work_mode: values.work_mode,
      schedule: blankToNull(values.schedule),
      benefits: blankToNull(values.benefits),
      contract_type: (values.contract_type || null) as ContractTypeValue | null,
      openings,
      recruiter_id: values.recruiter_id ? Number(values.recruiter_id) : null,
      status: values.status,
    },
    error: '',
  }
}

/** Admin job list filters. */
export function filterJobs<T extends { status: string; company_id: number }>(
  jobs: T[],
  status: JobStatusValue | '',
  companyId: string,
): T[] {
  return jobs.filter(
    (job) => (!status || normalizeJobStatus(job.status) === status) && (!companyId || String(job.company_id) === companyId),
  )
}
