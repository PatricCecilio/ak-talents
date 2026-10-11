import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { ApiError } from '../src/services/api.ts'
import { GOOGLE_IDENTITY_SCRIPT_URL, googleClientId, isGoogleLoginEnabled, isPopupUnreliable } from '../src/services/googleIdentity.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('without VITE_GOOGLE_CLIENT_ID there is no Google button', () => {
  assert.equal(isGoogleLoginEnabled({} as ImportMetaEnv), false)
  assert.equal(isGoogleLoginEnabled({ VITE_GOOGLE_CLIENT_ID: '   ' } as ImportMetaEnv), false)
  assert.equal(isGoogleLoginEnabled({ VITE_GOOGLE_CLIENT_ID: '123-abc.apps.googleusercontent.com' } as ImportMetaEnv), true)
  assert.equal(googleClientId({ VITE_GOOGLE_CLIENT_ID: ' 123-abc.apps.googleusercontent.com ' } as ImportMetaEnv), '123-abc.apps.googleusercontent.com')

  const button = read('src/components/auth/GoogleSignInButton.tsx')
  assert.match(button, /if \(!isGoogleButtonAvailable\(\)\) return null/)
  // isGoogleButtonAvailable starts from isGoogleLoginEnabled: no client ID, no button anywhere.
  assert.match(read('src/services/googleIdentity.ts'), /isGoogleButtonAvailable[^{]*\{\s*if \(!isGoogleLoginEnabled\(env\)\) return false/)
  assert.match(read('.env.example'), /VITE_GOOGLE_CLIENT_ID=""/)
})

test('candidate and company doors and sign-up have the button; /equipe never does', () => {
  const door = read('src/pages/LoginDoorPage.tsx')
  assert.match(door, /\{door !== 'equipe' \? \(\s*<div className="mb-5">\s*<GoogleSignInButton door=\{door\} \/>/)
  const register = read('src/pages/RegisterPage.tsx')
  assert.match(register, /<GoogleSignInButton\s+door=\{values\.role === 'company' \? 'empresa' : 'candidato'\}\s+externalConsent=\{privacyAccepted\}/)
})

test("Google's script is loaded only by the button, never site-wide", () => {
  assert.equal(GOOGLE_IDENTITY_SCRIPT_URL, 'https://accounts.google.com/gsi/client')
  for (const file of ['index.html', 'src/main.tsx', 'src/App.tsx', 'src/routes/AppRoutes.tsx']) {
    assert.doesNotMatch(read(file), /accounts\.google\.com\/gsi/, file)
  }
  assert.match(read('src/components/auth/GoogleSignInButton.tsx'), /loadGoogleIdentity\(\)/)
})

test('the door goes to the API; new accounts must accept the policy first', () => {
  const button = read('src/components/auth/GoogleSignInButton.tsx')
  assert.match(button, /authenticateWithGoogle\(\{ credential, door: latest\.current\.door, privacy_accepted: privacyAccepted \}\)/)
  // Login pages send no consent on the first try; the API answers consent_required for a new account.
  assert.match(button, /void send\(response\.credential, consent === undefined \? false : consent\)/)
  assert.match(button, /err\.code === 'consent_required'/)
  assert.match(button, /Criar conta e continuar/)
  assert.match(button, /disabled=\{!consentChecked \|\| isSending\}/)
  assert.match(button, /void send\(pendingCredential, true\)/)
  // Session only after the door decision; linked accounts get a notice.
  assert.ok(button.indexOf("decision.action === 'refuse'") < button.indexOf('startSession(response)'))
  assert.match(button, /response\.linked \? GOOGLE_LINKED_NOTICE : ''/)
  assert.match(read('src/services/authService.ts'), /apiRequest<GoogleSignInResponse>\('\/auth\/google'/)
})

test('API error codes reach the page', () => {
  const error = new ApiError(409, 'Para criar sua conta, leia e aceite a Política de Privacidade.', 'consent_required')
  assert.equal(error.code, 'consent_required')
  assert.equal(new ApiError(401, 'x').code, undefined)
  assert.match(read('src/services/api.ts'), /throw new ApiError\(response\.status, extractErrorMessage\(detail\), code\)/)
})

test('the consent step never widens the page nor duplicates the Google button', () => {
  const button = read('src/components/auth/GoogleSignInButton.tsx')
  // Google draws its button inside this element outside React: it stays mounted and is only hidden.
  assert.match(button, /<div ref=\{buttonRef\} className=\{`min-h-11 max-w-full justify-center overflow-hidden \$\{pendingCredential \? 'hidden' : 'flex'\}`\}/)
  assert.equal((button.match(/ref=\{buttonRef\}/g) ?? []).length, 1)
  // A fixed-width child (Google's button) cannot stretch the login card past the screen.
  assert.match(read('src/layouts/AuthLayout.tsx'), /grid-cols-\[minmax\(0,1fr\)\][^"]*lg:grid-cols-\[minmax\(0,0\.9fr\)_minmax\(0,1\.1fr\)\]/)
})

test('phones and tablets do not get the popup button (it hangs on a blank Google tab there)', () => {
  const android = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
  const edgeAndroid = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 EdgA/130.0.0.0'
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  const ipadOs = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
  const windowsChrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  assert.equal(isPopupUnreliable(android), true)
  assert.equal(isPopupUnreliable(edgeAndroid), true)
  assert.equal(isPopupUnreliable(iphone), true)
  assert.equal(isPopupUnreliable(ipadOs, 5), true)
  assert.equal(isPopupUnreliable(ipadOs, 0), false) // a real Mac
  assert.equal(isPopupUnreliable(windowsChrome), false)

  const button = read('src/components/auth/GoogleSignInButton.tsx')
  assert.match(button, /if \(!isGoogleButtonAvailable\(\)\) return null/)
  assert.match(read('src/pages/LoginDoorPage.tsx'), /Por enquanto, entre pelo computador/)
})
