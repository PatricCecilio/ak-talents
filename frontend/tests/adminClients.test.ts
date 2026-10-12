import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  EMPTY_COMPANY_FORM,
  EMPTY_JOB_FORM,
  JOB_STATUS_OPTIONS,
  companyFormToPayload,
  companyToForm,
  filterJobs,
  formatCnpj,
  formatPhone,
  jobFormToPayload,
  jobToForm,
  normalizeJobStatus,
} from '../src/services/adminForms.ts'
import { formatJobStatus } from '../src/services/jobFormat.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('company form: only name and WhatsApp are required; digits only go to the API', () => {
  assert.equal(companyFormToPayload(EMPTY_COMPANY_FORM).error, 'Informe o nome da empresa.')
  assert.equal(
    companyFormToPayload({ ...EMPTY_COMPANY_FORM, company_name: 'Padaria' }).error,
    'Confira o WhatsApp: informe o DDD e o número.',
  )
  assert.equal(
    companyFormToPayload({ ...EMPTY_COMPANY_FORM, company_name: 'Padaria', whatsapp: '41999990000', cnpj: '123' }).error,
    'Confira o CNPJ: são 14 números.',
  )
  const ok = companyFormToPayload({
    ...EMPTY_COMPANY_FORM,
    company_name: ' Padaria Boa Massa ',
    whatsapp: '(41) 99999-0000',
    cnpj: '12.345.678/0001-90',
    city: ' ',
    state: 'PR',
  })
  assert.deepEqual(ok.payload, {
    company_name: 'Padaria Boa Massa',
    cnpj: '12345678000190',
    responsible_name: null,
    whatsapp: '41999990000',
    contact_email: null,
    city: null,
    state: 'PR',
    notes: null,
  })
})

test('company form round-trip and display formats', () => {
  const values = companyToForm({
    company_name: 'Padaria',
    cnpj: '12345678000190',
    responsible_name: null,
    whatsapp: '41999990000',
    contact_email: null,
    city: 'Curitiba',
    state: 'Paraná', // old portal value: not a UF
    notes: null,
  })
  assert.equal(values.cnpj, '12.345.678/0001-90')
  assert.equal(values.whatsapp, '(41) 99999-0000')
  assert.equal(values.state, '')
  assert.equal(formatCnpj('123'), '123')
  assert.equal(formatPhone('5541999990000'), '(41) 99999-0000')
  assert.equal(formatPhone('4133330000'), '(41) 3333-0000')
})

test('job form: every field, recruiter and status; same validation as the API', () => {
  assert.equal(jobFormToPayload(EMPTY_JOB_FORM).error, 'Escolha a empresa da vaga.')
  const base = { ...EMPTY_JOB_FORM, company_id: '3', title: 'Padeiro', description: 'Produção de pães e doces.' }
  assert.equal(jobFormToPayload({ ...base, salary_min: '3000', salary_max: '2000' }).error, 'O salário mínimo não pode ser maior que o salário máximo.')
  assert.equal(jobFormToPayload({ ...base, openings: '0' }).error, 'A quantidade de vagas deve ser um número de 1 a 999.')

  const ok = jobFormToPayload({
    ...base,
    salary_min: '1800',
    salary_max: '2200,50',
    schedule: ' 6x1 ',
    benefits: '',
    contract_type: 'clt',
    openings: '2',
    recruiter_id: '7',
    status: 'approved',
  })
  assert.ok(ok.payload)
  assert.equal(ok.payload.company_id, 3)
  assert.equal(ok.payload.salary_max, 2200.5)
  assert.equal(ok.payload.schedule, '6x1')
  assert.equal(ok.payload.benefits, null)
  assert.equal(ok.payload.openings, 2)
  assert.equal(ok.payload.recruiter_id, 7)
  assert.equal(ok.payload.status, 'approved')
  assert.equal(jobFormToPayload(base).payload?.recruiter_id, null)
})

test('job statuses: Rascunho, Publicada, Encerrada (old ones read as the closest)', () => {
  assert.deepEqual(
    JOB_STATUS_OPTIONS.map((option) => [option.value, option.label]),
    [
      ['draft', 'Rascunho'],
      ['approved', 'Publicada'],
      ['closed', 'Encerrada'],
    ],
  )
  for (const option of JOB_STATUS_OPTIONS) assert.equal(formatJobStatus(option.value), option.label)
  assert.equal(normalizeJobStatus('pending'), 'draft')
  assert.equal(normalizeJobStatus('hidden'), 'closed')
  const detail = jobToForm({
    company_id: 1,
    title: 'T',
    description: 'D',
    requirements: null,
    salary_min: null,
    salary_max: 2000,
    location: null,
    work_mode: null,
    recruiter_id: null,
    status: 'pending',
  })
  assert.equal(detail.status, 'draft')
  assert.equal(detail.salary_max, '2000')
  assert.equal(detail.work_mode, 'onsite')

  const jobs = [
    { id: 1, status: 'approved', company_id: 1 },
    { id: 2, status: 'pending', company_id: 2 },
    { id: 3, status: 'closed', company_id: 1 },
  ]
  assert.deepEqual(filterJobs(jobs, 'draft', '').map((job) => job.id), [2])
  assert.deepEqual(filterJobs(jobs, '', '1').map((job) => job.id), [1, 3])
  assert.deepEqual(filterJobs(jobs, '', '').length, 3)
})

test('panel: create/edit/deactivate companies and jobs, publish and close', () => {
  const service = read('src/services/adminService.ts')
  assert.match(service, /apiRequest<AdminCompany>\('\/admin\/companies', \{ method: 'POST'/)
  assert.match(service, /`\/admin\/companies\/\$\{companyId\}`, \{ method: 'PUT'/)
  assert.match(service, /apiRequest<AdminJob>\('\/admin\/jobs', \{ method: 'POST'/)
  assert.match(service, /`\/admin\/jobs\/\$\{jobId\}`, \{ method: 'PUT'/)
  assert.equal((service.match(/method: 'DELETE'/g) ?? []).length, 1)

  const companies = read('src/panel/CompaniesPage.tsx')
  assert.match(companies, /<CompanyForm/)
  assert.match(companies, /\+ Nova empresa/)
  assert.match(companies, /setCompanyActive\(company\.id, false\)/)
  const jobs = read('src/panel/JobsPage.tsx')
  assert.match(jobs, /<JobForm/)
  assert.match(jobs, /\+ Nova vaga/)
  assert.match(jobs, /label: 'Publicar'/)
  assert.match(jobs, /label: 'Encerrar'/)
  assert.doesNotMatch(jobs, /Vaga aprovada\./)

  const jobForm = read('src/components/admin/JobForm.tsx')
  for (const field of ['salary-min', 'salary-max', 'contract', 'openings', 'schedule', 'benefits', 'recruiter', 'company']) {
    assert.match(jobForm, new RegExp(`\\$\\{prefix\\}-${field}`), field)
  }
  assert.match(jobForm, /JOB_STATUS_OPTIONS\.map/)
})
