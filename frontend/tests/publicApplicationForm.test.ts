import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  toPublicApplicationPayload,
  validatePublicApplicationForm,
  type PublicApplicationFormValues,
} from '../src/services/publicApplicationForm.ts'

const validValues: PublicApplicationFormValues = {
  full_name: 'Ana Silva',
  email: 'ana@example.com',
  phone: '(11) 99999-9999',
  city: 'Sao Paulo',
  neighborhood: 'Pinheiros',
  privacy_accepted: true,
}

test('public application form validates required fields', () => {
  assert.equal(validatePublicApplicationForm({ ...validValues, full_name: '' }).isValid, false)
  assert.equal(validatePublicApplicationForm({ ...validValues, email: '' }).isValid, false)
  assert.equal(validatePublicApplicationForm({ ...validValues, phone: '' }).isValid, false)
  assert.equal(validatePublicApplicationForm({ ...validValues, city: '' }).isValid, false)
  assert.equal(validatePublicApplicationForm({ ...validValues, neighborhood: '' }).isValid, false)
})

test('public application form does not submit without privacy acceptance', () => {
  const validation = validatePublicApplicationForm({ ...validValues, privacy_accepted: false })

  assert.equal(validation.isValid, false)
  assert.match(validation.message, /Aceite/)
})

test('public application form validates email and phone basics', () => {
  assert.equal(validatePublicApplicationForm({ ...validValues, email: 'ana' }).isValid, false)
  assert.equal(validatePublicApplicationForm({ ...validValues, phone: '123' }).isValid, false)
})

test('public application payload trims values before sending', () => {
  const payload = toPublicApplicationPayload({
    ...validValues,
    full_name: '  Ana Silva  ',
    email: '  ANA@EXAMPLE.COM  ',
  })

  assert.equal(payload.full_name, 'Ana Silva')
  assert.equal(payload.email, 'ANA@EXAMPLE.COM')
})

test('job detail page wires submit loading, success and error states', () => {
  const root = new URL('../', import.meta.url)
  const source = readFileSync(new URL('src/pages/JobDetailPage.tsx', root), 'utf8')

  assert.match(source, /createPublicApplication/)
  assert.match(source, /public_screening_token/)
  assert.match(source, /application_reference/)
  assert.match(source, /toRecruitmentScreeningOpenOptions/)
  assert.match(source, /openAppIntelliOptions/)
  assert.match(source, /getPublicScreening/)
  assert.match(source, /isSubmitting/)
  assert.match(source, /if \(isSubmitting \|\| applicationReference\) return/)
  assert.match(source, /setSuccess\('Candidatura recebida com sucesso/)
  assert.match(source, /setFormError/)
  assert.match(source, /disabled=\{isSubmitting\}/)
})

test('job detail page keeps legacy screening as a fallback after AppIntelli handoff', () => {
  const root = new URL('../', import.meta.url)
  const source = readFileSync(new URL('src/pages/JobDetailPage.tsx', root), 'utf8')

  assert.match(source, /handleLegacyScreeningStart/)
  assert.match(source, /screeningQuestions/)
  assert.match(source, /submitScreeningAnswers/)
  assert.match(source, /screeningToken/)
  assert.match(source, /YES_NO/)
  assert.match(source, /SINGLE_SELECT/)
  assert.match(source, /TEXT/)
  assert.match(source, /Responder triagem estruturada/)
})

test('job detail page does not send candidate PII to the widget context', () => {
  const root = new URL('../', import.meta.url)
  const widget = readFileSync(new URL('src/services/appIntelliWidget.ts', root), 'utf8')

  assert.match(widget, /applicationReference/)
  assert.doesNotMatch(widget, /full_name|email|phone|city|neighborhood/)
})

test('application service uses public screening token endpoints', () => {
  const root = new URL('../', import.meta.url)
  const source = readFileSync(new URL('src/services/applicationService.ts', root), 'utf8')

  assert.match(source, /\/public\/applications\/\$\{token\}\/screening/)
  assert.doesNotMatch(source, /\/applications\/\$\{applicationId\}\/screening/)
})

test('admin page wires configurable screening questions per job', () => {
  const root = new URL('../', import.meta.url)
  const source = readFileSync(new URL('src/pages/AdminPage.tsx', root), 'utf8')

  assert.match(source, /getJobScreeningQuestions/)
  assert.match(source, /updateJobScreeningQuestions/)
  assert.match(source, /Salvar triagem/)
  assert.match(source, /lista JSON de perguntas/)
})

test('jobs page handles unavailable API with a friendly retry state', () => {
  const root = new URL('../', import.meta.url)
  const source = readFileSync(new URL('src/pages/JobsPage.tsx', root), 'utf8')

  assert.match(source, /Nao foi possivel carregar as vagas no momento\./)
  assert.match(source, /Tente novamente em alguns instantes\./)
  assert.match(source, /Tentar novamente/)
  assert.match(source, /onClick=\{\(\) => void loadJobs\(\)\}/)
  assert.match(source, /No momento nao temos vagas disponiveis\./)
  assert.doesNotMatch(source, /Failed to fetch/)
})
