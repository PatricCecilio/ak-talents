import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { isPublicPage, publicPagesOnly, sanitizePagePath } from '../src/services/webAnalytics.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')
const SITE = 'https://www.aktalent.com.br'

test('only public pages are counted', () => {
  for (const path of ['/', '/vagas', '/vagas/', '/vagas/atendente-de-loja', '/privacidade', '/solucoes/recrutamento']) {
    assert.equal(isPublicPage(path), true, path)
  }
  for (const path of [
    '/equipe',
    '/recrutamento',
    '/admin',
    '/recrutador',
    '/recrutador/candidaturas/7',
    '/candidate',
    '/company',
    '/entrar',
    '/entrar/candidato',
    '/entrar/google',
    '/register',
    '/login',
    '/vagas/a/b',
  ]) {
    assert.equal(isPublicPage(path), false, path)
    assert.equal(publicPagesOnly({ type: 'pageview', url: `${SITE}${path}?x=1` }), null, path)
  }
})

test('never a query string, hash or personal data in the URL sent', () => {
  assert.equal(sanitizePagePath('/vagas/atendente?utm=x&email=ana@x.com#form'), '/vagas/atendente')
  assert.deepEqual(publicPagesOnly({ type: 'pageview', url: `${SITE}/?utm_source=teste&email=ana@example.com#topo` }), {
    type: 'pageview',
    url: `${SITE}/`,
  })
  assert.deepEqual(publicPagesOnly({ type: 'pageview', url: `${SITE}/vagas/atendente/?ref=whatsapp` }), {
    type: 'pageview',
    url: `${SITE}/vagas/atendente`,
  })
  assert.equal(publicPagesOnly({ type: 'pageview', url: `${SITE}/entrar/google?codigo=segredo` }), null)
  assert.equal(publicPagesOnly({ type: 'pageview', url: 'não é uma url' }), null)
})

test('Vercel Web Analytics with the filter; Google Analytics and the cookie banner are gone', () => {
  const routes = read('src/routes/AppRoutes.tsx')
  assert.match(routes, /import \{ Analytics \} from '@vercel\/analytics\/react'/)
  assert.match(routes, /<Analytics beforeSend=\{publicPagesOnly\} \/>/)
  assert.ok(JSON.parse(read('package.json')).dependencies['@vercel/analytics'])

  for (const file of ['src/components/CookieConsent.tsx', 'src/services/analytics.ts']) assert.equal(existsSync(new URL(file, root)), false, file)
  for (const file of ['src/routes/AppRoutes.tsx', 'src/components/Footer.tsx', 'src/vite-env.d.ts', '.env.example', 'index.html']) {
    assert.doesNotMatch(read(file), /VITE_GA_MEASUREMENT_ID|googletagmanager|gtag|CookieConsent|Preferências de cookies/, file)
  }

  // The SPA fallback never swallows Vercel's own /_vercel/insights script and endpoints.
  const spa = JSON.parse(read('vercel.json')).rewrites.find((rule: { destination: string }) => rule.destination === '/index.html')
  assert.equal(new RegExp(`^${spa.source}$`).test('/_vercel/insights/script.js'), false)
})
