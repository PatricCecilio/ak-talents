import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { getSalaryRangeError, SALARY_RANGE_ERROR } from '../src/services/jobValidation.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('salary range rejects minimum greater than maximum', () => {
  assert.equal(getSalaryRangeError(5000, 3000), SALARY_RANGE_ERROR)
})

test('salary range accepts ordered, equal and partial ranges', () => {
  assert.equal(getSalaryRangeError(3000, 5000), '')
  assert.equal(getSalaryRangeError(3000, 3000), '')
  assert.equal(getSalaryRangeError(3000, null), '')
  assert.equal(getSalaryRangeError(null, 5000), '')
  assert.equal(getSalaryRangeError(null, null), '')
})

test('company job forms validate the salary range before calling the API', () => {
  for (const path of ['src/pages/CompanyPage.tsx', 'src/components/company/AIOnboardingWizard.tsx']) {
    const source = read(path)
    assert.match(source, /getSalaryRangeError\(/, path)
    assert.ok(source.indexOf('getSalaryRangeError(') < source.indexOf('await createJob('), path)
  }
})
