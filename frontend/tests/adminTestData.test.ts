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
  // The only DELETE: a job nobody applied to (the API refuses the others with 409).
  assert.deepEqual(service.match(/method: 'DELETE'/g), ["method: 'DELETE'"])
  assert.match(service, /`\/admin\/jobs\/\$\{jobId\}`, \{ method: 'DELETE' \}/)
})

test('panel: companies are deactivated or reactivated, never deleted when they have jobs', () => {
  const page = read('src/panel/CompaniesPage.tsx')
  assert.match(page, /setCompanyActive\(company\.id, true\)/)
  assert.match(page, /setCompanyActive\(company\.id, false\)/)
  assert.match(page, /nada foi apagado/)
})
