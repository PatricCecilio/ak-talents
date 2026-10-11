import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { COMPANY_CLOSED_PATH, COMPANY_PORTAL_CLOSED_MESSAGE, isCompanyPortalEnabled } from '../src/services/companyPortal.ts'
import { GOOGLE_ERROR_MESSAGES } from '../src/services/googleIdentity.ts'
import { HIRE_EMAIL, hireContact } from '../src/services/whatsapp.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('the company portal is off unless VITE_COMPANY_PORTAL_ENABLED is exactly "true"', () => {
  assert.equal(isCompanyPortalEnabled({} as ImportMetaEnv), false)
  assert.equal(isCompanyPortalEnabled({ VITE_COMPANY_PORTAL_ENABLED: 'false' } as ImportMetaEnv), false)
  assert.equal(isCompanyPortalEnabled({ VITE_COMPANY_PORTAL_ENABLED: '1' } as ImportMetaEnv), false)
  assert.equal(isCompanyPortalEnabled({ VITE_COMPANY_PORTAL_ENABLED: ' true ' } as ImportMetaEnv), true)
  assert.match(read('.env.example'), /VITE_COMPANY_PORTAL_ENABLED="false"/)
})

test('the closed-portal message is the same one the API sends', () => {
  const backend = read('../backend/app/core/messages.py')
  const match = backend.match(/COMPANY_PORTAL_CLOSED = \(\s*"([^"]+)"\s*\)/)
  assert.ok(match)
  assert.equal(COMPANY_PORTAL_CLOSED_MESSAGE, match[1])
  assert.equal(GOOGLE_ERROR_MESSAGES.empresa, COMPANY_PORTAL_CLOSED_MESSAGE)
})

test('"Quero contratar" opens the commercial WhatsApp with a message, or e-mail while it is not set', () => {
  const whatsapp = hireContact({ VITE_WHATSAPP_URL: 'https://wa.me/5541999999999' } as ImportMetaEnv)
  assert.equal(whatsapp.channel, 'whatsapp')
  assert.equal(whatsapp.href, 'https://wa.me/5541999999999?text=Ol%C3%A1!%20Quero%20contratar%20com%20a%20AK%20Talent.')

  const email = hireContact({} as ImportMetaEnv)
  assert.equal(email.channel, 'email')
  assert.equal(email.href, `mailto:${HIRE_EMAIL}?subject=Quero%20contratar`)
  // Never a javascript: or plain-http link.
  assert.equal(hireContact({ VITE_WHATSAPP_URL: 'javascript:alert(1)' } as ImportMetaEnv).channel, 'email')
})

test('/entrar: only "Sou candidato" plus "Quero contratar" when the portal is off', () => {
  const chooser = read('src/pages/LoginChooserPage.tsx')
  assert.match(chooser, /const choices = companyPortal \? \[candidateChoice, companyChoice\] : \[candidateChoice\]/)
  assert.match(chooser, /\{companyPortal \? null : <HireContactLink variant="card" \/>\}/)
  assert.match(chooser, /searchParams\.get\('erro'\) === 'empresa'/)
  assert.match(read('src/components/HireContactLink.tsx'), /Quero contratar/)
})

test('sign-up is candidate-only and old company paths land on /entrar with the notice', () => {
  const register = read('src/pages/RegisterPage.tsx')
  assert.match(register, /\{companyPortal \? \(\s*<fieldset/)
  assert.match(register, /É empresa e quer contratar\?/)

  assert.equal(COMPANY_CLOSED_PATH, '/entrar?erro=empresa')
  const door = read('src/pages/LoginDoorPage.tsx')
  assert.match(door, /if \(door === 'empresa' && !isCompanyPortalEnabled\(\)\) return <Navigate to=\{COMPANY_CLOSED_PATH\} replace \/>/)
  // A company account trying to sign in gets the friendly notice and the way to talk to AK.
  assert.match(door, /error === COMPANY_PORTAL_CLOSED_MESSAGE \? \(/)

  const routes = read('src/routes/AppRoutes.tsx')
  assert.match(routes, /isCompanyPortalEnabled\(\) \? \(\s*<PrivateRoute allowedRoles=\{\['company'\]\}>\s*<CompanyPage \/>/)
  assert.match(routes, /<Navigate to=\{COMPANY_CLOSED_PATH\} replace \/>/)
})
