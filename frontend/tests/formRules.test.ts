import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { deleteJobConfirmation, filterJobs, jobRemovalAction } from '../src/services/adminForms.ts'
import {
  FIELD_MESSAGES,
  nativeValidityMessage,
  normalizeOptionalUrl,
  toCandidateProfilePayload,
  validateCandidateProfile,
  type CandidateProfileFormValues,
} from '../src/services/fieldValidation.ts'
import { formatJobStatus } from '../src/services/jobFormat.ts'
import { validatePublicApplicationForm } from '../src/services/publicApplicationForm.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

const EMPTY_PROFILE: CandidateProfileFormValues = {
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
}
const ESSENTIALS = { ...EMPTY_PROFILE, full_name: 'Ana Souza', phone: '(41) 99111-0002', city: 'Curitiba' }

test('profile: only name, phone/WhatsApp and city are required', () => {
  assert.deepEqual(validateCandidateProfile(ESSENTIALS), {})
  assert.deepEqual(validateCandidateProfile(EMPTY_PROFILE), {
    full_name: FIELD_MESSAGES.fullName,
    phone: FIELD_MESSAGES.phone,
    city: FIELD_MESSAGES.city,
  })
  assert.equal(validateCandidateProfile({ ...ESSENTIALS, phone: '9999' }).phone, FIELD_MESSAGES.phoneInvalid)

  const payload = toCandidateProfilePayload(ESSENTIALS)
  for (const field of ['linkedin_url', 'portfolio_url', 'resume_url', 'work_mode', 'salary_expectation', 'experience_years', 'state'] as const) {
    assert.equal(payload[field], null, field)
  }
})

test('profile: links are optional, checked only when filled in, and get https://', () => {
  assert.equal(normalizeOptionalUrl(''), '')
  assert.equal(normalizeOptionalUrl('linkedin.com/in/ana'), 'https://linkedin.com/in/ana')
  assert.equal(normalizeOptionalUrl(' https://ana.dev '), 'https://ana.dev')
  for (const bad of ['meu linkedin', 'curriculo', 'ftp://site.com', 'https://localhost']) assert.equal(normalizeOptionalUrl(bad), null, bad)

  const errors = validateCandidateProfile({ ...ESSENTIALS, linkedin_url: 'meu perfil', portfolio_url: 'site', resume_url: 'drive' })
  assert.equal(errors.linkedin_url, FIELD_MESSAGES.linkedin)
  assert.equal(errors.portfolio_url, FIELD_MESSAGES.portfolio)
  assert.equal(errors.resume_url, FIELD_MESSAGES.resume)
  assert.equal(toCandidateProfilePayload({ ...ESSENTIALS, linkedin_url: 'linkedin.com/in/ana' }).linkedin_url, 'https://linkedin.com/in/ana')
  assert.equal(validateCandidateProfile({ ...ESSENTIALS, salary_expectation: '-1' }).salary_expectation, FIELD_MESSAGES.negative)
})

test('the same messages as the API, in Portuguese', () => {
  const backend = read('../backend/app/core/messages.py')
  for (const [constant, message] of [
    ['PROFILE_NAME_REQUIRED', FIELD_MESSAGES.fullName],
    ['PROFILE_PHONE_REQUIRED', FIELD_MESSAGES.phone],
    ['PROFILE_CITY_REQUIRED', FIELD_MESSAGES.city],
    ['INVALID_LINKEDIN_URL', FIELD_MESSAGES.linkedin],
    ['INVALID_PORTFOLIO_URL', FIELD_MESSAGES.portfolio],
    ['INVALID_RESUME_URL', FIELD_MESSAGES.resume],
    ['INVALID_PHONE', FIELD_MESSAGES.phoneInvalid],
  ]) {
    assert.ok(backend.includes(`${constant} = "${message}"`), constant)
  }
})

test('profile form: own messages under each field, no English browser bubbles, optional fields marked', () => {
  const page = read('src/pages/CandidatePage.tsx')
  assert.match(page, /<form onSubmit=\{handleProfileSubmit\} noValidate/)
  assert.match(page, /const errors = validateCandidateProfile\(profileValues\)/)
  for (const field of ['full_name', 'phone', 'city', 'linkedin_url', 'portfolio_url', 'resume_url']) {
    assert.match(page, new RegExp(`error=\\{profileErrors\\.${field}\\}`), field)
  }
  for (const label of ['LinkedIn (opcional)', 'Portfólio (opcional)', 'Currículo, link (opcional)', 'Pretensão salarial (opcional)', 'Modelo de trabalho (opcional)']) {
    assert.ok(page.includes(label), label)
  }
  assert.match(page, /<option value="">Prefiro não informar<\/option>/)
  assert.match(page, /E-mail \(da sua conta\)/)

  const input = read('src/components/ui/Input.tsx')
  assert.match(input, /onInvalid=\{\(event\) => \{\s*portugueseValidity\(event\)/)
  assert.match(input, /<FieldError id=\{errorId \?\? ''\} message=\{error\} \/>/)
})

test('browser validity reaches the screen in Portuguese', () => {
  assert.equal(nativeValidityMessage({ valueMissing: true }), 'Preencha este campo.')
  assert.equal(nativeValidityMessage({ valueMissing: true }, 'checkbox'), 'Marque esta opção para continuar.')
  assert.equal(nativeValidityMessage({ typeMismatch: true }, 'email'), FIELD_MESSAGES.email)
  assert.equal(nativeValidityMessage({ rangeUnderflow: true }, 'number', '1'), 'Informe um valor igual ou maior que 1.')
  assert.equal(nativeValidityMessage({}), '')
})

test('public application form: same essentials, one message per field', () => {
  const valid = { full_name: 'Ana', email: 'ana@example.com', phone: '41999990000', city: 'Curitiba', neighborhood: '', privacy_accepted: true }
  assert.deepEqual(validatePublicApplicationForm(valid).fieldErrors, {})
  const empty = validatePublicApplicationForm({ ...valid, full_name: '', email: 'ana', phone: '', city: '', privacy_accepted: false })
  assert.deepEqual(Object.keys(empty.fieldErrors), ['full_name', 'email', 'phone', 'city', 'privacy_accepted'])
  assert.equal(empty.fieldErrors.email, 'Informe um e-mail válido.')
  assert.equal(empty.message, 'Informe seu nome completo.')

  const page = read('src/pages/JobDetailPage.tsx')
  assert.match(page, /ref=\{formRef\}\s*noValidate/)
  for (const field of ['full_name', 'email', 'phone', 'city']) {
    assert.match(page, new RegExp(`<FieldError id="application_${field}-error" message=\\{fieldErrors\\.${field}\\} />`), field)
  }
  assert.match(page, /<FieldError id="application_privacy-error" message=\{fieldErrors\.privacy_accepted\} \/>/)
})

test('admin jobs: delete only without applications, otherwise archive; archived ones only with the filter', () => {
  assert.equal(jobRemovalAction({ status: 'approved', applications_count: 0 }), 'delete')
  assert.equal(jobRemovalAction({ status: 'closed', applications_count: 3 }), 'archive')
  assert.equal(jobRemovalAction({ status: 'archived', applications_count: 3 }), 'unarchive')
  assert.equal(deleteJobConfirmation('Repositor'), 'Excluir a vaga Repositor? Essa ação não pode ser desfeita.')
  assert.equal(formatJobStatus('archived'), 'Arquivada')

  const jobs = [
    { id: 1, status: 'closed', company_id: 1 },
    { id: 2, status: 'archived', company_id: 1 },
  ]
  assert.deepEqual(filterJobs(jobs, 'closed', '').map((job) => job.id), [1])
  assert.deepEqual(filterJobs(jobs, '', '').map((job) => job.id), [1, 2])

  const page = read('src/pages/AdminPage.tsx')
  assert.match(page, /Mostrar arquivadas/)
  assert.match(page, /getAdminJobs\(includeArchived\)/)
  assert.match(page, /\{deleteJobConfirmation\(job\.title\)\}/)
  assert.match(page, /Sim, excluir/)
  assert.match(page, /setJobArchived\(job\.id, true\)/)
  assert.match(page, /setJobArchived\(job\.id, false\)/)
  // Delete is offered only through jobRemovalAction (never for a job with applications).
  assert.match(page, /\{jobRemovalAction\(job\) === 'delete' \? \(/)
  assert.match(read('src/services/adminService.ts'), /`\/admin\/jobs\/\$\{jobId\}\/archived`, \{ method: 'PUT', body: \{ archived \} \}/)
})
