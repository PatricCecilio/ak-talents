import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { decideAfterLogin } from '../src/services/loginDoors.ts'
import { roleHome } from '../src/services/roleHome.ts'
import { STAFF_ROLES } from '../src/types/user.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('recruiter is an internal role that public sign-up never offers', () => {
  assert.deepEqual(STAFF_ROLES, ['admin', 'recruiter'])
  const register = read('src/pages/RegisterPage.tsx')
  assert.doesNotMatch(register, /value: 'recruiter'|value: 'admin'/)
})

test('recruiters land on /painel after login', () => {
  assert.equal(roleHome('recruiter'), '/painel')
  assert.deepEqual(decideAfterLogin('recrutamento', 'recruiter'), { action: 'enter', to: '/painel' })
})

test('the panel is private to admin and recruiter and lives outside the public layout', () => {
  const routes = read('src/routes/AppRoutes.tsx')
  assert.match(routes, /<PrivateRoute allowedRoles=\{\['recruiter', 'admin'\]\} signedOut=\{<PanelSignedOut \/>\}>\s*<PanelLayout \/>/)
  // Must not live inside the public layout (public header/footer).
  assert.ok(routes.indexOf('path="/painel"') < routes.indexOf('<Route element={<MainLayout />}>'))
})

test('only the admin manages the team and assigns the responsible recruiter', () => {
  assert.match(read('src/services/adminService.ts'), /'\/admin\/recruiters'/)
  const team = read('src/panel/TeamPages.tsx')
  assert.match(team, /createRecruiter\(/)
  assert.match(read('src/panel/panelApi.ts'), /`\/panel\/jobs\/\$\{jobId\}\/responsible`/)
  const jobs = read('src/panel/JobsPage.tsx')
  assert.match(jobs, /if \(isAdmin\) \{\s*list\.push\(\{ label: 'Trocar recrutadora'/)
})
