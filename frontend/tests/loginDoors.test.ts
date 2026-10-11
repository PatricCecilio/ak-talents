import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  DOOR_COPY,
  DOOR_PATHS,
  STAFF_ONLY_MESSAGE,
  decideAfterLogin,
  doorPathForRole,
  type LoginDoor,
} from '../src/services/loginDoors.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

const HOME = { candidate: '/candidate', company: '/company', admin: '/admin', recruiter: '/recrutador' } as const

test('each door x each role: right door enters quietly, wrong public door enters with a notice', () => {
  const ownDoor: Record<keyof typeof HOME, LoginDoor> = { candidate: 'candidato', company: 'empresa', admin: 'equipe', recruiter: 'equipe' }
  for (const door of ['candidato', 'empresa', 'equipe'] as const) {
    for (const role of ['candidate', 'company', 'admin', 'recruiter'] as const) {
      const decision = decideAfterLogin(door, role)
      const label = `${door} x ${role}`
      if (door === 'equipe' && (role === 'candidate' || role === 'company')) {
        assert.equal(decision.action, 'refuse', label)
        continue
      }
      assert.equal(decision.action, 'enter', label)
      if (decision.action !== 'enter') continue
      assert.equal(decision.to, HOME[role], label)
      if (door === ownDoor[role]) assert.equal(decision.notice, undefined, label)
      else assert.ok(decision.notice && decision.notice.length > 20, label)
    }
  }
})

test('notices and refusals say what happened, in Portuguese', () => {
  assert.deepEqual(decideAfterLogin('candidato', 'company'), {
    action: 'enter',
    to: '/company',
    notice: 'Você entrou pela área de candidatos, mas sua conta é de empresa. Abrimos o painel da empresa.',
  })
  assert.deepEqual(decideAfterLogin('empresa', 'candidate'), {
    action: 'enter',
    to: '/candidate',
    notice: 'Você entrou pela área de empresas, mas sua conta é de candidato. Abrimos o painel do candidato.',
  })
  assert.equal(STAFF_ONLY_MESSAGE, 'Esta área é só para a equipe AK Talent.')
  assert.deepEqual(decideAfterLogin('equipe', 'company'), {
    action: 'refuse',
    message: STAFF_ONLY_MESSAGE,
    link: { label: 'Entrar como empresa', to: '/entrar/empresa' },
  })
  assert.deepEqual(decideAfterLogin('equipe', 'candidate'), {
    action: 'refuse',
    message: STAFF_ONLY_MESSAGE,
    link: { label: 'Entrar como candidato', to: '/entrar/candidato' },
  })
  // Staff using a public door is not blocked either.
  assert.equal(decideAfterLogin('candidato', 'admin').action, 'enter')
})

test('door paths, copy and sign-up links', () => {
  assert.deepEqual(DOOR_PATHS, { candidato: '/entrar/candidato', empresa: '/entrar/empresa', equipe: '/equipe' })
  assert.deepEqual(DOOR_COPY.candidato.signUp, { prompt: 'Ainda não tem conta?', label: 'Criar conta de candidato', to: '/register?tipo=candidato' })
  assert.deepEqual(DOOR_COPY.empresa.signUp, { prompt: 'Sua empresa ainda não tem conta?', label: 'Cadastrar minha empresa', to: '/register?tipo=empresa' })
  assert.equal(DOOR_COPY.equipe.signUp, null)
  assert.equal(doorPathForRole('company'), '/entrar/empresa')
  assert.equal(doorPathForRole('candidate'), '/entrar/candidato')
  assert.equal(doorPathForRole('recruiter'), '/equipe')
})

test('routes: chooser, three doors, /equipe hidden and noindex, /login redirects to /entrar', () => {
  const routes = read('src/routes/AppRoutes.tsx')
  assert.match(routes, /<Route path="\/entrar" element=\{<LoginChooserPage \/>\} \/>/)
  assert.match(routes, /<Route path="\/entrar\/candidato" element=\{<LoginDoorPage key="candidato" door="candidato" \/>\} \/>/)
  assert.match(routes, /<Route path="\/entrar\/empresa" element=\{<LoginDoorPage key="empresa" door="empresa" \/>\} \/>/)
  assert.match(routes, /<Route path="\/equipe" element=\{<LoginDoorPage key="equipe" door="equipe" \/>\} \/>/)
  assert.match(routes, /<Route path="\/login" element=\{<LegacyLoginRedirect \/>\} \/>/)
  assert.match(routes, /<Navigate to="\/entrar" replace state=\{state\} \/>/)

  const chooser = read('src/pages/LoginChooserPage.tsx')
  assert.match(chooser, /Você é…/)
  assert.match(chooser, /'Sou candidato'/)
  assert.match(chooser, /'Sou empresa'/)
  assert.doesNotMatch(chooser, /equipe/i)

  const door = read('src/pages/LoginDoorPage.tsx')
  assert.match(door, /door === 'equipe' \? <meta name="robots" content="noindex, nofollow" \/> : null/)
  // The session is only stored after the door accepted the account.
  assert.ok(door.indexOf("decision.action === 'refuse'") < door.indexOf('startSession(response)'))
  assert.doesNotMatch(door, /loginUser\(/)

  for (const file of ['src/components/Header.tsx', 'src/components/Footer.tsx', 'src/pages/HomePage.tsx', 'src/pages/LoginChooserPage.tsx']) {
    assert.doesNotMatch(read(file), /\/equipe/, `${file} não pode linkar /equipe`)
  }
})

test('sign-up preselects the account type from ?tipo=', () => {
  const register = read('src/pages/RegisterPage.tsx')
  assert.match(register, /role: roleFromQuery\(searchParams\.get\('tipo'\)\)/)
  assert.match(register, /return tipo === 'empresa' \? 'company' : 'candidate'/)
})
