import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { PRIVACY_CONTACT_EMAIL, PRIVACY_POLICY_PATH, PRIVACY_POLICY_VERSION } from '../src/services/privacyPolicy.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('privacy policy version matches the version the backend stores with each consent', () => {
  const backend = read('../backend/app/core/privacy.py')
  const match = backend.match(/PRIVACY_POLICY_VERSION = "([^"]+)"/)
  assert.ok(match, 'backend PRIVACY_POLICY_VERSION not found')
  assert.equal(PRIVACY_POLICY_VERSION, match[1])
})

test('privacy page is routed and covers the required topics, with the real company data', () => {
  assert.equal(PRIVACY_POLICY_PATH, '/privacidade')
  assert.match(read('src/routes/AppRoutes.tsx'), /<Route path="\/privacidade" element=\{<PrivacyPage \/>\} \/>/)

  const page = read('src/pages/PrivacyPage.tsx')
  // No placeholder left: no [UPPERCASE TEXT] and no highlighted <mark>/Placeholder component.
  assert.doesNotMatch(page, /\[[A-ZÀ-Ú][A-ZÀ-Ú0-9 _\-/]*\]/)
  assert.doesNotMatch(page, /Placeholder|<mark|bg-amber-100/)
  for (const fact of [
    'AK Talent (63.263.799 PATRIC CECILIO), Microempreendedor Individual',
    '63.263.799/0001-29',
    'até 24 meses após o encerramento do último',
    'pelo prazo exigido',
    'obrigações legais e fiscais',
  ]) {
    assert.ok(page.includes(fact), `missing ${fact}`)
  }
  assert.equal(PRIVACY_CONTACT_EMAIL, 'contato@aktalent.com.br')
  assert.match(page, /href=\{`mailto:\$\{PRIVACY_CONTACT_EMAIL\}`\}/)
  for (const topic of [
    'Quais dados coletamos',
    'Para que usamos seus dados',
    'Com quem compartilhamos',
    'Empresas clientes',
    'AppIntelli',
    'OpenAI',
    'Por quanto tempo guardamos',
    'Seus direitos',
    'Como exercer seus direitos',
  ]) {
    assert.ok(page.includes(topic), `missing topic ${topic}`)
  }
})

test('footer, public application and sign-up link to the privacy policy', () => {
  assert.match(read('src/components/Footer.tsx'), /href="\/privacidade"/)

  const jobDetail = read('src/pages/JobDetailPage.tsx')
  assert.match(jobDetail, /href=\{PRIVACY_POLICY_PATH\}/)
  assert.match(jobDetail, /id="application_privacy"/)

  const register = read('src/pages/RegisterPage.tsx')
  assert.match(register, /href=\{PRIVACY_POLICY_PATH\}/)
  assert.match(register, /privacy_accepted: privacyAccepted/)
  assert.match(register, /if \(!privacyAccepted\) \{/)
  assert.ok(register.indexOf('if (!privacyAccepted)') < register.indexOf('await registerUser('))
})
