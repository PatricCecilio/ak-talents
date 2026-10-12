import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { ApiError } from '../src/services/api.ts'
import {
  GOOGLE_ERROR_MESSAGES,
  GOOGLE_IDENTITY_SCRIPT_URL,
  googleClientId,
  googleErrorMessage,
  googleReturnUri,
  isGoogleLoginEnabled,
} from '../src/services/googleIdentity.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('without VITE_GOOGLE_CLIENT_ID there is no Google button', () => {
  assert.equal(isGoogleLoginEnabled({} as ImportMetaEnv), false)
  assert.equal(isGoogleLoginEnabled({ VITE_GOOGLE_CLIENT_ID: '   ' } as ImportMetaEnv), false)
  assert.equal(isGoogleLoginEnabled({ VITE_GOOGLE_CLIENT_ID: '123-abc.apps.googleusercontent.com' } as ImportMetaEnv), true)
  assert.equal(googleClientId({ VITE_GOOGLE_CLIENT_ID: ' 123-abc.apps.googleusercontent.com ' } as ImportMetaEnv), '123-abc.apps.googleusercontent.com')
  assert.match(read('src/components/auth/GoogleSignInButton.tsx'), /if \(!isGoogleLoginEnabled\(\)\) return null/)
  assert.match(read('.env.example'), /VITE_GOOGLE_CLIENT_ID=""/)
})

test('candidate and company doors and sign-up have the button (all browsers); /equipe never does', () => {
  const door = read('src/pages/LoginDoorPage.tsx')
  assert.match(door, /\{door === 'candidato' \|\| door === 'empresa' \? \(\s*<div className="mb-5">\s*<GoogleSignInButton door=\{door\} \/>/)
  assert.match(read('src/pages/RegisterPage.tsx'), /<GoogleSignInButton door=\{values\.role === 'company' \? 'empresa' : 'candidato'\} divider="above" \/>/)
  assert.doesNotMatch(read('src/services/googleIdentity.ts'), /isPopupUnreliable/)
})

test("Google's script is loaded only by the button, never site-wide", () => {
  assert.equal(GOOGLE_IDENTITY_SCRIPT_URL, 'https://accounts.google.com/gsi/client')
  for (const file of ['index.html', 'src/main.tsx', 'src/App.tsx', 'src/routes/AppRoutes.tsx']) {
    assert.doesNotMatch(read(file), /accounts\.google\.com\/gsi/, file)
  }
  assert.match(read('src/components/auth/GoogleSignInButton.tsx'), /loadGoogleIdentity\(\)/)
})

test('redirect mode: Google comes back to the site origin, one return path per door', () => {
  const button = read('src/components/auth/GoogleSignInButton.tsx')
  assert.match(button, /ux_mode: 'redirect'/)
  assert.match(button, /login_uri: googleReturnUri\(door\)/)
  assert.doesNotMatch(button, /ux_mode: 'popup'|callback:/)
  // Re-rendered when the sign-up page switches Candidato <-> Empresa.
  assert.match(button, /\}, \[door\]\)/)
  assert.equal(googleReturnUri('candidato', 'https://www.aktalent.com.br'), 'https://www.aktalent.com.br/auth/google/retorno/candidato')
  assert.equal(googleReturnUri('empresa', 'http://localhost:5173'), 'http://localhost:5173/auth/google/retorno/empresa')
})

test('the return path is forwarded to the API in production (vercel.json) and locally (Vite proxy)', () => {
  const config = JSON.parse(read('vercel.json'))
  const index = config.rewrites.findIndex((rule: { source: string }) => rule.source === '/auth/google/retorno/:door')
  assert.ok(index >= 0)
  assert.equal(config.rewrites[index].destination, 'https://ak-talent-api.vercel.app/auth/google/redirect/:door')
  const spaIndex = config.rewrites.findIndex((rule: { destination: string }) => rule.destination === '/index.html')
  assert.ok(index < spaIndex, 'antes da regra do SPA')

  const vite = read('vite.config.ts')
  assert.match(vite, /'\/auth\/google\/retorno': \{/)
  assert.match(vite, /path\.replace\('\/auth\/google\/retorno', '\/auth\/google\/redirect'\)/)
  assert.match(vite, /server: \{[\s\S]*proxy: googleReturnProxy/)
  assert.match(vite, /preview: \{\s*proxy: googleReturnProxy/)
})

test('return page: exchanges the one-time code once, cleans the URL, asks consent for new accounts', () => {
  const page = read('src/pages/GoogleReturnPage.tsx')
  assert.match(page, /window\.history\.replaceState\(null, '', window\.location\.pathname\)/)
  assert.match(page, /if \(!codes\.codigo \|\| exchanged\.current\) return/)
  assert.match(page, /exchangeGoogleCode\(codes\.codigo\)/)
  assert.match(page, /completeGoogleConsent\(codes\.consentimento\)/)
  assert.match(page, /disabled=\{!consentChecked \|\| isSending\}/)
  assert.match(page, /Criar conta e continuar/)
  assert.match(page, /<meta name="robots" content="noindex, nofollow" \/>/)
  // Session only after the door decision; linked accounts get a notice.
  assert.ok(page.indexOf("decision.action === 'refuse'") < page.indexOf('startSession(response)'))
  assert.match(page, /response\.linked \? GOOGLE_LINKED_NOTICE : ''/)
  assert.match(read('src/routes/AppRoutes.tsx'), /<Route path="\/entrar\/google" element=\{<GoogleReturnPage \/>\} \/>/)

  const auth = read('src/services/authService.ts')
  assert.match(auth, /'\/auth\/google\/codigo'/)
  assert.match(auth, /'\/auth\/google\/consentimento'/)
  assert.match(auth, /body: \{ codigo, privacy_accepted: true \}/)
})

test('refusals from the redirect come back as ?erro= and are shown in Portuguese', () => {
  assert.equal(googleErrorMessage(null), '')
  assert.equal(googleErrorMessage('equipe'), 'Use o acesso da equipe em /equipe.')
  assert.equal(googleErrorMessage('qualquer-coisa'), GOOGLE_ERROR_MESSAGES.token)
  for (const code of ['csrf', 'token', 'email_nao_verificado', 'equipe', 'inativo', 'outra_conta', 'indisponivel']) {
    assert.ok(GOOGLE_ERROR_MESSAGES[code], code)
  }
  assert.match(read('src/pages/LoginDoorPage.tsx'), /useState\(\(\) => googleErrorMessage\(searchParams\.get\('erro'\)\)\)/)
})

test('API error codes reach the page', () => {
  const error = new ApiError(409, 'Para criar sua conta, leia e aceite a Política de Privacidade.', 'consent_required')
  assert.equal(error.code, 'consent_required')
  assert.equal(new ApiError(401, 'x').code, undefined)
})

test('the login card never widens the page', () => {
  const button = read('src/components/auth/GoogleSignInButton.tsx')
  assert.match(button, /<div ref=\{buttonRef\} className="flex min-h-11 max-w-full justify-center overflow-hidden" \/>/)
  assert.match(read('src/layouts/AuthLayout.tsx'), /grid-cols-\[minmax\(0,1fr\)\][^"]*lg:grid-cols-\[minmax\(0,0\.9fr\)_minmax\(0,1\.1fr\)\]/)
})
