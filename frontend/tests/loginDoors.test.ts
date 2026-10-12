import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  DOOR_COPY,
  DOOR_PATHS,
  STAFF_ONLY_MESSAGE,
  decideAfterLogin,
  doorPathForRole,
  isStaffDoor,
  type LoginDoor,
} from '../src/services/loginDoors.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

const HOME = { candidate: '/candidate', company: '/company', admin: '/painel', recruiter: '/painel' } as const

test('each door x each role: right door enters quietly, wrong door enters with a notice', () => {
  const ownDoor: Record<keyof typeof HOME, LoginDoor> = { candidate: 'candidato', company: 'empresa', admin: 'equipe', recruiter: 'recrutamento' }
  for (const door of ['candidato', 'empresa', 'equipe', 'recrutamento'] as const) {
    for (const role of ['candidate', 'company', 'admin', 'recruiter'] as const) {
      const decision = decideAfterLogin(door, role)
      const label = `${door} x ${role}`
      if (isStaffDoor(door) && (role === 'candidate' || role === 'company')) {
        assert.equal(decision.action, 'refuse', label)
        continue
      }
      assert.equal(decision.action, 'enter', label)
      if (decision.action !== 'enter') continue
      assert.equal(decision.to, HOME[role], label)
      if (door === ownDoor[role] || (isStaffDoor(door) && isStaffDoor(ownDoor[role]))) assert.equal(decision.notice, undefined, label)
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
  assert.equal(decideAfterLogin('recrutamento', 'candidate').action, 'refuse')
  // Both internal doors lead to the same panel: no notice either way.
  assert.deepEqual(decideAfterLogin('equipe', 'recruiter'), { action: 'enter', to: '/painel' })
  assert.deepEqual(decideAfterLogin('recrutamento', 'admin'), { action: 'enter', to: '/painel' })
  // Staff using a public door is not blocked either.
  assert.equal(decideAfterLogin('candidato', 'admin').action, 'enter')
})

test('door paths, copy and sign-up links', () => {
  assert.deepEqual(DOOR_PATHS, { candidato: '/entrar/candidato', empresa: '/entrar/empresa', equipe: '/equipe', recrutamento: '/recrutamento' })
  assert.equal(DOOR_COPY.recrutamento.signUp, null)
  assert.deepEqual(DOOR_COPY.candidato.signUp, { prompt: 'Ainda não tem conta?', label: 'Criar conta de candidato', to: '/register?tipo=candidato' })
  assert.deepEqual(DOOR_COPY.empresa.signUp, { prompt: 'Sua empresa ainda não tem conta?', label: 'Cadastrar minha empresa', to: '/register?tipo=empresa' })
  assert.equal(DOOR_COPY.equipe.signUp, null)
  assert.equal(doorPathForRole('company'), '/entrar/empresa')
  assert.equal(doorPathForRole('candidate'), '/entrar/candidato')
  assert.equal(doorPathForRole('recruiter'), '/recrutamento')
  assert.equal(doorPathForRole('admin'), '/equipe')
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
  assert.match(door, /\{staffDoor \? <meta name="robots" content="noindex, nofollow" \/> : null\}/)
  assert.match(door, /const staffDoor = isStaffDoor\(door\)/)
  assert.match(routes, /<Route path="\/recrutamento" element=\{<LoginDoorPage key="recrutamento" door="recrutamento" \/>\} \/>/)
  // The session is only stored after the door accepted the account.
  assert.ok(door.indexOf("decision.action === 'refuse'") < door.indexOf('startSession(response)'))
  assert.doesNotMatch(door, /loginUser\(/)

  for (const file of ['src/components/Header.tsx', 'src/components/Footer.tsx', 'src/pages/HomePage.tsx', 'src/pages/LoginChooserPage.tsx']) {
    // "/solucoes/recrutamento" (marketing page) is fine; the login door "/recrutamento" is not.
    assert.doesNotMatch(read(file), /\/equipe|['"`]\/recrutamento/, `${file} não pode linkar /equipe nem /recrutamento`)
  }
})

test('sign-up preselects the account type from ?tipo=', () => {
  const register = read('src/pages/RegisterPage.tsx')
  assert.match(register, /role: roleFromQuery\(searchParams\.get\('tipo'\)\)/)
  assert.match(register, /return tipo === 'empresa' && isCompanyPortalEnabled\(\) \? 'company' : 'candidate'/)
})

test('private areas send signed-out visitors straight to the right door (the panel lets them pick)', () => {
  const privateRoute = read('src/components/PrivateRoute.tsx')
  assert.match(privateRoute, /if \(signedOut\) return signedOut/)
  assert.match(privateRoute, /<Navigate to=\{doorPathForRole\(allowedRoles\?\.\[0\]\)\} replace state=\{\{ from: location\.pathname \}\} \/>/)
  // The first allowed role of each private area decides the door; /painel shows "Sou da administração" / "Sou recrutadora".
  const routes = read('src/routes/AppRoutes.tsx')
  assert.match(routes, /<PrivateRoute allowedRoles=\{\['recruiter', 'admin'\]\} signedOut=\{<PanelSignedOut \/>\}>/)
  const chooser = read('src/panel/PanelSignedOut.tsx')
  assert.match(chooser, /<Link to=\{STAFF_LOGIN_PATH\} state=\{\{ from \}\}[^>]*>\s*Sou da administração/)
  assert.match(chooser, /<Link to=\{RECRUITER_LOGIN_PATH\} state=\{\{ from \}\}[^>]*>\s*Sou recrutadora/)
  assert.equal(doorPathForRole('recruiter'), '/recrutamento')
  assert.equal(doorPathForRole('admin'), '/equipe')
  assert.match(routes, /allowedRoles=\{\['company'\]\}/)
  assert.equal(doorPathForRole('company'), '/entrar/empresa')
  assert.match(routes, /allowedRoles=\{\['candidate'\]\}/)
  assert.equal(doorPathForRole('candidate'), '/entrar/candidato')
  assert.equal(doorPathForRole(undefined), '/entrar/candidato')
})

test('"Entrar" goes to /entrar; signing out returns to the right login; wrong-door notice on the panels', () => {
  assert.equal((read('src/components/Header.tsx').match(/href=\{LOGIN_CHOOSER_PATH\}/g) ?? []).length, 2)
  assert.doesNotMatch(read('src/components/Header.tsx'), /href="\/login"/)
  assert.match(read('src/panel/PanelLayout.tsx'), /window\.location\.href = doorPathForRole\(role\)/)
  assert.match(read('src/pages/CandidatePage.tsx'), /window\.location\.href = LOGIN_CHOOSER_PATH/)
  assert.match(read('src/pages/CompanyPage.tsx'), /window\.location\.href = LOGIN_CHOOSER_PATH/)

  assert.match(read('src/layouts/DashboardShell.tsx'), /<LoginNotice \/>/)
  assert.match(read('src/panel/PanelLayout.tsx'), /<LoginNotice \/>\s*<Outlet /)
  const notice = read('src/components/LoginNotice.tsx')
  assert.match(notice, /state\?\.loginNotice/)
  assert.match(notice, /aria-label="Fechar aviso"/)
  assert.match(read('src/pages/LoginDoorPage.tsx'), /const to = returnPathAfterLogin\(from, response\.user\.role\) \?\? decision\.to/)
  assert.match(read('src/pages/LoginDoorPage.tsx'), /navigate\(to, decision\.notice \? \{ state: \{ loginNotice: decision\.notice \} \} : undefined\)/)
})

test('/equipe and /recrutamento are also marked noindex by an HTTP header (robots that do not run JavaScript)', () => {
  const config = JSON.parse(read('vercel.json'))
  for (const source of ['/equipe', '/recrutamento', '/painel/:path*']) {
    const rule = config.headers.find((entry: { source: string }) => entry.source === source)
    assert.deepEqual(rule.headers, [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }], source)
  }
  // Listing it in robots.txt would only advertise the address.
  let robots = ''
  try {
    robots = read('public/robots.txt')
  } catch {
    // No robots.txt at all.
  }
  assert.doesNotMatch(robots, /equipe/)
})

test('phones/tablets: form first under a thin strip and a short title; /equipe without marketing cards', () => {
  const layout = read('src/layouts/AuthLayout.tsx')
  // The big dark panel only from lg (1024px) up; below it a thin strip and the title above the form.
  assert.match(layout, /<aside className="hidden bg-ink-950 p-10 text-white lg:block">/)
  assert.match(layout, /<div data-auth-strip className="bg-ink-950 px-5 py-2\.5 lg:hidden">/)
  assert.match(layout, /<div className="mb-5 lg:hidden">\s*<h1 className="text-2xl/)
  assert.ok(layout.indexOf('data-auth-strip') < layout.indexOf('{children}'))
  // Cards are optional and only inside the desktop panel.
  assert.match(layout, /\{showHighlights \? \(\s*<div className="mt-10 grid gap-4/)
  assert.ok(layout.indexOf('Triagem inteligente') < layout.indexOf('</aside>'))
  assert.match(read('src/pages/LoginDoorPage.tsx'), /showHighlights=\{!staffDoor\}/)
})
