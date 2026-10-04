import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('admin service exposes deactivate/hide endpoints (never delete)', () => {
  const service = read('src/services/adminService.ts')
  assert.match(service, /\/admin\/companies\/\$\{companyId\}\/active/)
  assert.match(service, /\/admin\/candidates\/\$\{candidateId\}\/active/)
  assert.match(service, /\/admin\/applications\/\$\{applicationId\}\/hidden/)
  assert.match(service, /include_hidden=true/)
  assert.doesNotMatch(service, /method: 'DELETE'/)
})

test('admin page: deactivate/reactivate companies and candidates, hide applications, show hidden filter', () => {
  const page = read('src/pages/AdminPage.tsx')
  assert.match(page, /setCompanyActive\(company\.id, company\.is_active === false\)/)
  assert.match(page, /setCandidateActive\(candidate\.id, candidate\.is_active === false\)/)
  assert.match(page, /setApplicationHidden\(application\.id, !application\.is_hidden\)/)
  assert.match(page, /Mostrar candidaturas ocultas/)
  assert.match(page, /nada foi apagado/)
  assert.match(page, /Etapa: \{application\.stage_label \?\? application\.status\}/)
})
