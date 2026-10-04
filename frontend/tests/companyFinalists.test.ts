import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { companyJobProgress } from '../src/services/companyProgress.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('job progress for companies groups stages into simple words, counts only', () => {
  const progress = companyJobProgress({ new: 2, screening: 3, ak_interview: 1, finalist: 2, client_approved: 1, hired: 1, rejected: 5, withdrawn: 1 })
  assert.deepEqual(progress, [
    { label: 'Em triagem', value: 5 },
    { label: 'Entrevista', value: 1 },
    { label: 'Finalistas', value: 2 },
    { label: 'Aprovados por você', value: 1 },
    { label: 'Contratados', value: 1 },
  ])
  assert.deepEqual(
    companyJobProgress(undefined).map((item) => item.value),
    [0, 0, 0, 0, 0],
  )
})

test('/company starts with "Finalistas para aprovar" and shows job progress', () => {
  const page = read('src/pages/CompanyPage.tsx')
  assert.ok(page.indexOf('<FinalistsSection />') < page.indexOf("setCreationMode('ai')"), 'finalists come first')
  assert.match(page, /companyJobProgress\(job\.stage_counts\)/)
})

test('finalist card: approve / reject with optional reason; no contact before approval', () => {
  const section = read('src/components/company/FinalistsSection.tsx')
  for (const text of ['Finalistas para aprovar', 'Aprovar para entrevista', 'Recusar', 'Motivo da recusa (opcional)', 'Parecer da AK Talent']) {
    assert.ok(section.includes(text), text)
  }
  assert.match(section, /decideFinalist\(finalist\.application_id, decision/)

  // Contact data is only rendered by the approved list, never by the pending finalist card.
  const pendingCard = section.slice(section.indexOf('function FinalistCard'), section.indexOf('function ApprovedCard'))
  assert.doesNotMatch(pendingCard, /finalist\.phone|finalist\.email/)
  const approvedCard = section.slice(section.indexOf('function ApprovedCard'), section.indexOf('export function FinalistsSection'))
  assert.match(approvedCard, /finalist\.phone/)
})

test('company screens use the landing look', () => {
  assert.doesNotMatch(read('src/components/company/FinalistsSection.tsx'), /components\/ui'/)
})
