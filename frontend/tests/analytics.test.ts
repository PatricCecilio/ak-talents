import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { gaMeasurementId, isTrackedPath, pageViewParams, sanitizePagePath } from '../src/services/analytics.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('no VITE_GA_MEASUREMENT_ID (or an odd value) means no Analytics at all', () => {
  assert.equal(gaMeasurementId({} as ImportMetaEnv), '')
  assert.equal(gaMeasurementId({ VITE_GA_MEASUREMENT_ID: '  ' } as ImportMetaEnv), '')
  assert.equal(gaMeasurementId({ VITE_GA_MEASUREMENT_ID: 'UA-123-1' } as ImportMetaEnv), '')
  assert.equal(gaMeasurementId({ VITE_GA_MEASUREMENT_ID: 'G-ABC123"><script>' } as ImportMetaEnv), '')
  assert.equal(gaMeasurementId({ VITE_GA_MEASUREMENT_ID: ' G-ABC123XYZ ' } as ImportMetaEnv), 'G-ABC123XYZ')
  assert.match(read('.env.example'), /VITE_GA_MEASUREMENT_ID=""/)
  assert.match(read('src/components/CookieConsent.tsx'), /if \(!id\) return null/)
})

test('only public pages are measured', () => {
  for (const path of ['/', '/vagas', '/vagas/', '/vagas/atendente-de-loja', '/privacidade', '/solucoes/recrutamento']) {
    assert.equal(isTrackedPath(path), true, path)
  }
  for (const path of [
    '/equipe',
    '/recrutamento',
    '/admin',
    '/recrutador',
    '/recrutador/vagas/3',
    '/candidate',
    '/company',
    '/entrar',
    '/entrar/candidato',
    '/entrar/google',
    '/register',
    '/login',
    '/vagas/a/b',
    '/qualquer',
  ]) {
    assert.equal(isTrackedPath(path), false, path)
  }
})

test('never a query string, hash or personal data in what GA receives', () => {
  assert.equal(sanitizePagePath('/vagas/atendente?utm=x&email=ana@x.com#form'), '/vagas/atendente')
  assert.equal(sanitizePagePath('/entrar/google?codigo=abc123'), '/entrar/google')
  assert.deepEqual(pageViewParams('https://www.aktalent.com.br', '/vagas?email=ana@x.com', 'Vagas'), {
    page_location: 'https://www.aktalent.com.br/vagas',
    page_path: '/vagas',
    page_title: 'Vagas',
  })

  const service = read('src/services/analytics.ts')
  assert.match(service, /send_page_view: false/)
  assert.match(service, /allow_google_signals: false/)
  assert.match(service, /allow_ad_personalization_signals: false/)
  assert.match(service, /gtag\('set', \{ page_location: params\.page_location \}\)/)
  assert.doesNotMatch(service, /location\.search|location\.href/)
})

test('gtag loads only after "Aceitar"; private routes switch GA off; page views on route changes', () => {
  const consent = read('src/components/CookieConsent.tsx')
  // The only place that loads gtag, guarded by the stored choice.
  assert.match(consent, /if \(!id \|\| choice !== 'accepted'\) return\s*\/\/[^\n]*\n\s*setAnalyticsEnabled\(id, tracked\)\s*loadAnalytics\(id\)\s*if \(tracked\) trackPageView\(id, pathname\)/)
  assert.match(consent, /\}, \[id, choice, pathname, tracked\]\)/)
  assert.match(consent, />\s*Recusar\s*</)
  assert.match(consent, />\s*Aceitar\s*</)
  assert.match(consent, /if \(next === 'declined'\) revokeAnalytics\(id\)/)
  // The banner never shows on private/login pages unless the visitor reopens it.
  assert.match(consent, /const showBanner = reopened \|\| \(choice === null && tracked\)/)
  assert.doesNotMatch(read('index.html'), /googletagmanager|gtag/)
  for (const file of ['src/main.tsx', 'src/App.tsx']) assert.doesNotMatch(read(file), /googletagmanager|loadAnalytics/, file)

  const service = read('src/services/analytics.ts')
  assert.match(service, /`ga-disable-\$\{id\}`/)
  // The same page is never counted twice in a row (React runs mount effects twice in development).
  assert.match(service, /if \(params\.page_path === lastTrackedPath\) return/)
  assert.match(read('src/routes/AppRoutes.tsx'), /<CookieConsent \/>/)
  const footer = read('src/components/Footer.tsx')
  assert.match(footer, /onClick=\{openCookiePreferences\}/)
  assert.match(footer, /Preferências de cookies/)
})
