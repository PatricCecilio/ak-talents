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
