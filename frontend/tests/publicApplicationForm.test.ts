import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  toPublicApplicationPayload,
  validatePublicApplicationForm,
  type PublicApplicationFormValues,
} from '../src/services/publicApplicationForm.ts'
import {
  APPLICATION_CONFIRMATION_MESSAGE,
  firstMissingRequiredAnswer,
  stepAfterApplication,
  toScreeningAnswers,
} from '../src/services/applicationFlow.ts'
import { isScreeningChatEnabled } from '../src/services/screeningChat.ts'

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

test('job detail page wires submit loading and error states', () => {
  const root = new URL('../', import.meta.url)
  const source = readFileSync(new URL('src/pages/JobDetailPage.tsx', root), 'utf8')

  assert.match(source, /createPublicApplication/)
  assert.match(source, /public_screening_token/)
  assert.match(source, /isSubmitting/)
  assert.match(source, /if \(isSubmitting \|\| screeningToken\) return/)
  assert.match(source, /setFormError/)
  assert.match(source, /disabled=\{isSubmitting\}/)
})

test('job detail page ends with a clear confirmation and never opens the chat by itself', () => {
  const root = new URL('../', import.meta.url)
  const source = readFileSync(new URL('src/pages/JobDetailPage.tsx', root), 'utf8')

  assert.match(source, /screening_completed/)
  assert.match(source, /stepAfterApplication\(response\.screening_completed, questions\)/)
  assert.match(source, /APPLICATION_CONFIRMATION_TITLE/)
  assert.match(source, /APPLICATION_CONFIRMATION_MESSAGE/)
  assert.match(source, /step === 'done'/)
  assert.match(source, /Ver outras vagas/)
  assert.doesNotMatch(source, /setTimeout/)
  assert.doesNotMatch(source, /Continuar triagem|Responder triagem estruturada/)
})

test('job detail page asks the screening questions on the page when the job has them', () => {
  const root = new URL('../', import.meta.url)
  const source = readFileSync(new URL('src/pages/JobDetailPage.tsx', root), 'utf8')

  assert.match(source, /getPublicScreening/)
  assert.match(source, /job\?\.screening_questions/)
  assert.match(source, /step === 'questions'/)
  assert.match(source, /submitScreeningAnswers/)
  assert.match(source, /firstMissingRequiredAnswer/)
  assert.match(source, /YES_NO/)
  assert.match(source, /SINGLE_SELECT/)
  assert.match(source, /TEXT/)
  assert.match(source, /Concluir candidatura/)
})

test('apply button scrolls to the form and focuses the first field', () => {
  const root = new URL('../', import.meta.url)
  const source = readFileSync(new URL('src/pages/JobDetailPage.tsx', root), 'utf8')

  assert.match(source, /onClick=\{openApplicationForm\}/)
  assert.match(source, /formRef\.current\?\.scrollIntoView/)
  assert.match(source, /firstFieldRef\.current\?\.focus/)
  assert.match(source, /ref=\{firstFieldRef\}/)
  assert.ok(source.indexOf('ref={firstFieldRef}') > source.indexOf('id="application_full_name"'))
})

test('the next step after applying depends on screening_completed and the questions', () => {
  const question = { id: 1, key: 'sabado', label: 'Sábado?', question_type: 'YES_NO', required: true, sort_order: 0 } as const

  assert.equal(stepAfterApplication(true, []), 'done')
  assert.equal(stepAfterApplication(true, [question]), 'done')
  assert.equal(stepAfterApplication(false, []), 'done')
  assert.equal(stepAfterApplication(false, [question]), 'questions')
  assert.match(APPLICATION_CONFIRMATION_MESSAGE, /WhatsApp ou telefone informado/)
})

test('screening answers: required check and payload', () => {
  const questions = [
    { id: 1, key: 'sabado', label: 'Sábado?', question_type: 'YES_NO', required: true, sort_order: 0 },
    { id: 2, key: 'turno', label: 'Turno', question_type: 'SINGLE_SELECT', required: true, sort_order: 1 },
    { id: 3, key: 'obs', label: 'Observações', question_type: 'TEXT', required: false, sort_order: 2 },
  ] as const

  assert.equal(firstMissingRequiredAnswer([...questions], {})?.id, 1)
  // "Não" is a valid answer for a yes/no question.
  assert.equal(firstMissingRequiredAnswer([...questions], { 1: false })?.id, 2)
  assert.equal(firstMissingRequiredAnswer([...questions], { 1: false, 2: '  ' })?.id, 2)
  assert.equal(firstMissingRequiredAnswer([...questions], { 1: false, 2: 'manha' }), undefined)

  assert.deepEqual(toScreeningAnswers([...questions], { 1: false, 2: 'manha', 3: '  posso começar já  ' }), [
    { question_id: 1, value: false },
    { question_id: 2, value: 'manha' },
    { question_id: 3, value: 'posso começar já' },
  ])
  assert.deepEqual(toScreeningAnswers([...questions], { 1: true, 2: 'tarde', 3: '' }), [
    { question_id: 1, value: true },
    { question_id: 2, value: 'tarde' },
  ])
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

  const errorState = readFileSync(new URL('src/components/LoadErrorState.tsx', root), 'utf8')

  assert.match(source, /Não conseguimos carregar as vagas agora\./)
  assert.match(source, /Confira sua conexão com a internet/)
  assert.match(source, /onRetry=\{\(\) => loadJobs\(\)\}/)
  assert.match(errorState, /Tentar novamente/)
  assert.match(errorState, /min-h-12/)
  assert.match(source, /Nenhuma vaga aberta agora/)
  assert.match(source, /<JobsUnavailableNotice/)
  assert.doesNotMatch(source, /Failed to fetch|Alert tone="error"/)
})

test('job detail page shows friendly closed-job and connection states', () => {
  const root = new URL('../', import.meta.url)
  const source = readFileSync(new URL('src/pages/JobDetailPage.tsx', root), 'utf8')

  assert.match(source, /Esta vaga não está mais disponível\./)
  assert.match(source, /Não conseguimos abrir esta vaga\./)
  assert.match(source, /Ver outras vagas/)
  assert.match(source, /err\.isNotFound/)
  assert.match(source, /err\.isNetworkError/)
  assert.doesNotMatch(source, /Status: \{screeningResult\.screening_status\}/)
})

test('AppIntelli screening chat flag is off unless explicitly "true"', () => {
  assert.equal(isScreeningChatEnabled({}), false)
  assert.equal(isScreeningChatEnabled({ VITE_APPINTELLI_SCREENING_ENABLED: '' }), false)
  assert.equal(isScreeningChatEnabled({ VITE_APPINTELLI_SCREENING_ENABLED: 'false' }), false)
  assert.equal(isScreeningChatEnabled({ VITE_APPINTELLI_SCREENING_ENABLED: '1' }), false)
  assert.equal(isScreeningChatEnabled({ VITE_APPINTELLI_SCREENING_ENABLED: 'true' }), true)
  assert.equal(isScreeningChatEnabled({ VITE_APPINTELLI_SCREENING_ENABLED: ' TRUE ' }), true)

  const root = new URL('../', import.meta.url)
  const example = readFileSync(new URL('.env.example', root), 'utf8')
  assert.match(example, /VITE_APPINTELLI_SCREENING_ENABLED="false"/)
})

test('the screening chat is an opt-in link behind the flag, never opened automatically', () => {
  const root = new URL('../', import.meta.url)
  const source = readFileSync(new URL('src/pages/JobDetailPage.tsx', root), 'utf8')

  assert.match(source, /\{screeningChatEnabled && applicationReference \? \(/)
  assert.match(source, /Prefere responder conversando\?/)
  assert.match(source, /onClick=\{openScreeningChat\}/)
  // The only call to the widget is the click handler.
  assert.equal(source.match(/openAppIntelliOptions\(/g)?.length, 1)
  assert.ok(source.indexOf('openAppIntelliOptions(') > source.indexOf('function openScreeningChat()'))
})

test('applying twice shows the API reassurance as a neutral notice, not an error', () => {
  const root = new URL('../', import.meta.url)
  const source = readFileSync(new URL('src/pages/JobDetailPage.tsx', root), 'utf8')

  assert.match(source, /err instanceof ApiError && err\.status === 409\) setFormNotice\(err\.message\)/)
  assert.match(source, /\{formNotice \? <Alert tone="info">\{formNotice\}<\/Alert> : null\}/)
})

test('neighborhood is optional: valid without it and left out of the payload when blank', () => {
  assert.equal(validatePublicApplicationForm({ ...validValues, neighborhood: '' }).isValid, true)
  assert.equal(toPublicApplicationPayload({ ...validValues, neighborhood: '   ' }).neighborhood, undefined)
  assert.equal(toPublicApplicationPayload(validValues).neighborhood, 'Pinheiros')

  const root = new URL('../', import.meta.url)
  assert.match(readFileSync(new URL('src/pages/JobDetailPage.tsx', root), 'utf8'), /Bairro \(opcional\)/)
})
