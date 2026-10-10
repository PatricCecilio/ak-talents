import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { formatJobStatus } from '../src/services/jobFormat.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('company dashboard lists its own jobs, not the public list of every company', () => {
  const page = read('src/pages/CompanyPage.tsx')
  const service = read('src/services/jobService.ts')

  assert.match(service, /'\/companies\/me\/jobs'/)
  assert.match(page, /getMyCompanyJobs\(\)/)
  assert.doesNotMatch(page, /\bgetJobs\b/)
})

test('company dashboard shows applicants only, with Portuguese labels', () => {
  const page = read('src/pages/CompanyPage.tsx')

  assert.match(page, /Ver candidatos inscritos/)
  assert.match(page, /Ainda não há candidaturas para esta vaga\./)
  assert.doesNotMatch(page, /candidatos compativeis|Nenhum candidato encontrado/)
  assert.match(page, /formatJobStatus\(/)
})

test('job status labels are friendly for companies', () => {
  assert.equal(formatJobStatus('pending'), 'Aguardando aprovação')
  assert.equal(formatJobStatus('approved'), 'Publicada')
  assert.equal(formatJobStatus('hidden'), 'Oculta')
  assert.equal(formatJobStatus(null), '')
})

test('AI features only when the API says the assistant is configured', () => {
  const root = new URL('../', import.meta.url)
  const read = (path: string) => readFileSync(new URL(path, root), 'utf8')
  const company = read('src/pages/CompanyPage.tsx')
  const candidate = read('src/pages/CandidatePage.tsx')

  assert.match(read('src/services/aiService.ts'), /'\/ai\/status'/)
  assert.match(read('src/hooks/useAiAvailable.ts'), /useState\(false\)/)
  assert.match(company, /useState<'ai' \| 'manual'>\('manual'\)/)
  assert.match(company, /\{aiAvailable \? \(\s*<button/)
  assert.match(company, /creationMode === 'ai' && aiAvailable \? \(/)
  // Manual comes first.
  assert.ok(company.indexOf("setCreationMode('manual')") < company.indexOf("setCreationMode('ai')"))
  assert.match(candidate, /\{aiAvailable \? \(\s*<Card className="mt-8 p-6">\s*<form onSubmit=\{handleCareerAI\}/)
  assert.match(read('src/components/AiComingSoon.tsx'), /aria-disabled="true"/)
  assert.match(read('src/components/AiComingSoon.tsx'), /Em breve/)
})
