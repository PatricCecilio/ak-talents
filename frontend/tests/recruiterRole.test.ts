import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { roleHome } from '../src/services/roleHome.ts'
import { STAFF_ROLES } from '../src/types/user.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('recruiter is an internal role that public sign-up never offers', () => {
  assert.deepEqual(STAFF_ROLES, ['admin', 'recruiter'])
  const register = read('src/pages/RegisterPage.tsx')
  assert.doesNotMatch(register, /value: 'recruiter'|value: 'admin'/)
})

test('recruiters land on /recrutador after login', () => {
  assert.equal(roleHome('recruiter'), '/recrutador')
  assert.match(read('src/pages/LoginPage.tsx'), /navigate\(roleHome\(response\.user\.role\)\)/)
})

test('/recrutador is private to admin and recruiter and uses the internal layout', () => {
  const routes = read('src/routes/AppRoutes.tsx')
  assert.match(routes, /<PrivateRoute allowedRoles=\{\['admin', 'recruiter'\]\}>\s*<WorkspaceLayout \/>/)
  assert.match(routes, /<Route path="\/recrutador" element=\{<RecruiterHomePage \/>\} \/>/)
  // Must not live inside the public layout (public header/footer).
  assert.ok(routes.indexOf('path="/recrutador"') < routes.indexOf('<Route element={<MainLayout />}>'))
})

test('admin manages the recruiting team; recruiters set the responsible person per job', () => {
  const service = read('src/services/adminService.ts')
  assert.match(service, /'\/admin\/recruiters'/)
  assert.match(read('src/pages/AdminPage.tsx'), /<RecruiterTeamSection \/>/)
  assert.match(read('src/services/recruiterService.ts'), /\/recruiter\/jobs\/\$\{jobId\}\/responsible/)
  assert.match(read('src/pages/recruiter/RecruiterHomePage.tsx'), /<ResponsibleSelect/)
})

test('new screens use the landing look (brand components), not the old dashboard UI kit', () => {
  for (const path of [
    'src/pages/recruiter/RecruiterHomePage.tsx',
    'src/components/admin/RecruiterTeamSection.tsx',
    'src/components/recruiter/ResponsibleSelect.tsx',
    'src/layouts/WorkspaceLayout.tsx',
  ]) {
    assert.doesNotMatch(read(path), /components\/ui'/, path)
  }
})
