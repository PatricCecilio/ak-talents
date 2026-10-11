import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { firstName, roleHome } from '../src/services/roleHome.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('each account type has its own panel', () => {
  assert.equal(roleHome('admin'), '/admin')
  assert.equal(roleHome('recruiter'), '/recrutador')
  assert.equal(roleHome('company'), '/company')
  assert.equal(roleHome('candidate'), '/candidate')
  assert.equal(roleHome(undefined), '/candidate')
  assert.equal(firstName('  Ana Maria Souza '), 'Ana')
  assert.equal(firstName(''), '')
})

test('phone header: collapsed ☰ menu instead of a second fixed row of links', () => {
  const header = read('src/components/Header.tsx')
  assert.match(header, /aria-expanded=\{menuOpen\}/)
  assert.match(header, /aria-controls="menu-celular"/)
  assert.match(header, /\{menuOpen \? \(\s*<nav id="menu-celular"/)
  assert.match(header, /event\.key === 'Escape'/)
  assert.match(header, /pointerdown/)
  // Closes on navigation: the open state belongs to the location it was opened on.
  assert.match(header, /openAt === location\.key/)
  assert.doesNotMatch(header, /Principal mobile/)
  assert.match(read('src/layouts/MainLayout.tsx'), /'pt-20 lg:pt-24'/)
})

test('signed in: name, link to the right panel and "Sair" instead of "Entrar"', () => {
  const header = read('src/components/Header.tsx')
  assert.match(header, /getCurrentUser\(\)/)
  assert.match(header, /\{user \? \(/)
  assert.match(header, /Olá, \{firstName\(user\.name\)\}/)
  assert.match(header, /to=\{roleHome\(user\.role\)\}/)
  assert.match(header, /Meu painel/)
  assert.match(header, /Sair/)
  // "Entrar" only in the signed-out branches.
  for (const match of header.matchAll(/>\s*Entrar\s*</g)) {
    const before = header.slice(0, match.index)
    assert.ok(before.lastIndexOf(') : (') > before.lastIndexOf('{user ? ('), 'Entrar fora do ramo deslogado')
  }
})

test('login and sign-up link to each other; sign-up signs in and opens the right panel', () => {
  const login = read('src/pages/LoginDoorPage.tsx')
  const register = read('src/pages/RegisterPage.tsx')
  const auth = read('src/services/authService.ts')

  assert.match(login, /\{copy\.signUp\.prompt\}\{' '\}\s*<Link to=\{copy\.signUp\.to\}/)
  assert.match(register, /Já tem conta\?\{' '\}\s*<Link to=\{doorPathForRole\(values\.role\)\}[^>]*>\s*Entrar/)
  const registerFn = auth.slice(auth.indexOf('export async function registerUser'), auth.indexOf('export async function authenticate'))
  assert.match(registerFn, /persistSession\(response\)/)
  assert.match(register, /const response = await registerUser\(/)
  assert.match(register, /navigate\(roleHome\(response\.user\.role\)\)/)
  assert.doesNotMatch(register, /navigate\('\/login'/)
})

test('every new page opens at the top, section links keep their own scrolling', () => {
  const scroll = read('src/components/ScrollToTop.tsx')
  assert.match(scroll, /if \(!hash\) window\.scrollTo\(0, 0\)/)
  assert.match(read('src/routes/AppRoutes.tsx'), /<ScrollToTop \/>/)
})

test('home hero starts right below the one-row phone header', () => {
  const home = read('src/pages/HomePage.tsx')
  // Header is h-20 below lg: pt-28 leaves a normal gap (the old pt-44 was sized for a two-row header).
  assert.match(home, /pb-12 pt-28 lg:min-h-\[44rem\]/)
  assert.doesNotMatch(home, /pt-44|sm:pt-40/)
})
