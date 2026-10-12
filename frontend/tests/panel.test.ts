import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  BOARD_COLUMNS,
  CANDIDATE_STAGE_FILTERS,
  COLUMN_TITLES,
  EXIT_STAGES,
  STAGE_TONES,
  candidateLinks,
  cardSubtitle,
  daysAgo,
  erasureConfirmed,
  greeting,
  initials,
  jobsQuery,
  jobStatus,
  legacyPanelPath,
  longDate,
  maskPhone,
  panelMenu,
  publicJobUrl,
  publishedFor,
  relativeTime,
  safeExternalUrl,
  shortAge,
} from '../src/panel/panelFormat.ts'
import { returnPathAfterLogin } from '../src/services/loginDoors.ts'
import { AK_STAGE_LABELS } from '../src/services/pipelineFormat.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')
const NOW = new Date(2026, 9, 12, 15, 0)

test('menu: Visão geral, Empresas, Vagas (with the count), Candidatos; Recrutadoras only for the admin', () => {
  const admin = panelMenu('admin')
  assert.deepEqual(admin.main.map((item) => item.label), ['Visão geral', 'Empresas', 'Vagas', 'Candidatos'])
  assert.deepEqual(admin.admin.map((item) => item.label), ['Recrutadoras'])
  assert.equal(admin.main.find((item) => item.label === 'Vagas')?.badge, 'to_triage')
  assert.deepEqual(panelMenu('recruiter').admin, [])
  assert.ok(!admin.main.some((item) => /Candidaturas|Relatórios|Configurações/.test(item.label)))
})

test('dates and labels in Portuguese', () => {
  assert.equal(greeting(new Date(2026, 9, 12, 9)), 'Bom dia')
  assert.equal(greeting(NOW), 'Boa tarde')
  assert.equal(greeting(new Date(2026, 9, 12, 20)), 'Boa noite')
  assert.equal(longDate(NOW), 'segunda, 12 de outubro')
  assert.equal(relativeTime(new Date(2026, 9, 12, 14, 50).toISOString(), NOW), 'há 10 min')
  assert.equal(relativeTime(new Date(2026, 9, 12, 13, 0).toISOString(), NOW), 'há 2 h')
  assert.equal(relativeTime(new Date(2026, 9, 11, 20, 0).toISOString(), NOW), 'ontem')
  assert.equal(relativeTime(new Date(2026, 9, 9, 10, 0).toISOString(), NOW), 'há 3 dias')
  assert.equal(relativeTime(new Date(2026, 9, 1, 10, 0).toISOString(), NOW), '01/10')
  assert.equal(shortAge(new Date(2026, 9, 12, 8).toISOString(), NOW), 'hoje')
  assert.equal(shortAge(new Date(2026, 9, 10, 8).toISOString(), NOW), '2 dias')
  assert.equal(publishedFor(new Date(2026, 9, 6).toISOString(), NOW), '6 dias')
  assert.equal(publishedFor(null, NOW), '—')
  assert.equal(daysAgo(new Date(2026, 9, 6, 23).toISOString(), NOW), 6)
  assert.equal(initials('Ariane Ribeiro'), 'AR')
  assert.equal(initials(''), 'AK')
  assert.equal(jobStatus('approved').label, 'Publicada')
  assert.equal(jobStatus('archived').label, 'Arquivada')
  assert.equal(cardSubtitle('Curitiba', 2), 'Curitiba · 2 anos')
  assert.equal(cardSubtitle('Pinhais', 0), 'Pinhais · 1º emprego')
  assert.equal(cardSubtitle(null, null), 'Cidade não informada')
  assert.equal(publicJobUrl('atendente'), 'https://www.aktalent.com.br/vagas/atendente')
})

test('board: the six stages in order, exits hidden by default; same names as the pipeline', () => {
  assert.deepEqual([...BOARD_COLUMNS], ['new', 'screening', 'ak_interview', 'finalist', 'client_approved', 'hired'])
  assert.deepEqual([...EXIT_STAGES], ['rejected', 'withdrawn'])
  assert.equal(COLUMN_TITLES.finalist, 'Enviado ao cliente')
  assert.equal(COLUMN_TITLES.client_approved, 'Cliente aprovou')
  const page = read('src/panel/JobPage.tsx')
  // Drag only opens the existing "Mover" dialog (same rules: opinion, client answer, hiring).
  assert.match(page, /setMoving\(\{ card, to: stage \}\)/)
  assert.match(page, /<MoveStageDialog[\s\S]*initialStage=\{moving\.to\}/)
  assert.match(page, /Não dá para mover direto de/)
  assert.match(page, /card\.waiting_client_too_long/)
  assert.match(read('src/components/recruiter/MoveStageDialog.tsx'), /useState<StageValue \| ''>\(initialStage \?\? ''\)/)
})

test('jobs list query only sends what is set', () => {
  assert.equal(jobsQuery({}), '')
  assert.equal(jobsQuery({ status: 'approved', mine: true, include_archived: false, page: 2 }), '?status=approved&mine=true&page=2')
  assert.equal(jobsQuery({ focus: 'to_triage', company_id: 3 }), '?focus=to_triage&company_id=3')
})

test('/painel is the only team area: /admin and /recrutador open the same item there; private, noindex', () => {
  const routes = read('src/routes/AppRoutes.tsx')
  assert.match(routes, /<PrivateRoute allowedRoles=\{\['recruiter', 'admin'\]\} signedOut=\{<PanelSignedOut \/>\}>\s*<PanelLayout \/>/)
  for (const path of ['/painel', '/painel/vagas', '/painel/vagas/:jobId', '/painel/candidaturas/:applicationId']) {
    assert.ok(routes.includes(`path="${path}"`), path)
  }
  assert.match(routes, /<Route path="\/admin\/\*" element=\{<LegacyPanelRedirect \/>\} \/>/)
  assert.match(routes, /<Route path="\/recrutador\/\*" element=\{<LegacyPanelRedirect \/>\} \/>/)
  assert.doesNotMatch(routes, /AdminPage|RecruiterHomePage|RecruiterJobPage|WorkspaceLayout/)
  assert.equal(legacyPanelPath('/admin'), '/painel')
  assert.equal(legacyPanelPath('/recrutador'), '/painel')
  assert.equal(legacyPanelPath('/recrutador/vagas/12'), '/painel/vagas/12')
  assert.equal(legacyPanelPath('/recrutador/candidaturas/7/'), '/painel/candidaturas/7')
  assert.equal(legacyPanelPath('/recrutador/vagas/abc'), '/painel')
  const layout = read('src/panel/PanelLayout.tsx')
  assert.match(layout, /<meta name="robots" content="noindex, nofollow" \/>/)
  assert.match(layout, /aria-label="Abrir menu"/)
  assert.match(read('src/panel/PanelSignedOut.tsx'), /<meta name="robots" content="noindex, nofollow" \/>/)
})

test('after the login the team goes back to the panel page that was asked for, and nowhere else', () => {
  assert.equal(returnPathAfterLogin('/painel/vagas/12', 'admin'), '/painel/vagas/12')
  assert.equal(returnPathAfterLogin('/painel', 'recruiter'), '/painel')
  assert.equal(returnPathAfterLogin('/painel/vagas/12', 'candidate'), null)
  assert.equal(returnPathAfterLogin('https://outro.site/painel', 'admin'), null)
  assert.equal(returnPathAfterLogin('/candidate', 'admin'), null)
  assert.equal(returnPathAfterLogin('/painelx', 'admin'), null)
  assert.equal(returnPathAfterLogin(undefined, 'admin'), null)
})

test('desktop keeps the page still only when the window is tall enough; shorter windows scroll the page', () => {
  const css = read('src/index.css')
  assert.match(css, /@custom-variant fit \(@media \(min-width: 80rem\) and \(min-height: 46rem\)\);/)
  const layout = read('src/panel/PanelLayout.tsx')
  assert.match(layout, /xl:flex fit:h-svh fit:overflow-hidden/)
  assert.match(layout, /xl:sticky xl:top-0 xl:block xl:h-svh/)
  // No panel screen locks its height with plain xl: anymore (that is what cut the screens at 1366x768).
  for (const file of ['CandidateProfilePage', 'CandidatesPage', 'CompaniesPage', 'JobPage', 'JobsPage', 'OverviewPage', 'PanelLayout', 'TeamPages']) {
    // (The sidebar's own height is fine: it stays put while the page scrolls.)
    const source = read(`src/panel/${file}.tsx`).replace('xl:sticky xl:top-0 xl:block xl:h-svh', '')
    assert.doesNotMatch(source, /xl:(h-full|h-svh|min-h-0|overflow-hidden|overflow-y-auto)\b/, file)
  }
})

test('the panel is a separate chunk: the public site does not download it', () => {
  const routes = read('src/routes/AppRoutes.tsx')
  assert.match(routes, /lazy\(\(\) => import\('\.\.\/panel'\)/)
  assert.doesNotMatch(routes, /from '\.\.\/panel\/(?!panelFormat')/)
  assert.match(routes, /<Suspense fallback=\{null\}>/)
})

test('candidate links: only http(s), new tab, no opener; LinkedIn, portfólio and currículo', () => {
  assert.equal(safeExternalUrl('https://linkedin.com/in/ana'), 'https://linkedin.com/in/ana')
  assert.equal(safeExternalUrl('http://exemplo.com.br/cv.pdf'), 'http://exemplo.com.br/cv.pdf')
  assert.equal(safeExternalUrl('javascript:alert(1)'), null)
  assert.equal(safeExternalUrl('data:text/html,oi'), null)
  assert.equal(safeExternalUrl('linkedin.com/in/ana'), null)
  assert.equal(safeExternalUrl('  '), null)
  assert.equal(safeExternalUrl(null), null)
  assert.deepEqual(
    candidateLinks({ linkedin_url: 'https://linkedin.com/in/ana', portfolio_url: 'javascript:x', resume_url: 'https://drive.google.com/cv' }),
    [
      { label: 'LinkedIn', href: 'https://linkedin.com/in/ana' },
      { label: 'Currículo', href: 'https://drive.google.com/cv' },
    ],
  )
  const ui = read('src/panel/PanelUi.tsx')
  assert.match(ui, /<a key=\{link\.label\} href=\{link\.href\} target="_blank" rel="noopener noreferrer"/)
  assert.match(read('src/panel/ApplicationPage.tsx'), /<CandidateLinks candidate=\{candidate\} \/>/)
  assert.match(read('src/panel/CandidateProfilePage.tsx'), /<CandidateLinks candidate=\{candidate\} \/>/)
  assert.doesNotMatch(read('src/panel/CandidateProfilePage.tsx'), /href=\{candidate\.(linkedin|resume|portfolio)_url\}/)
})

test('application screen: "Sobre a vaga" with company, city, mode, salary, schedule, description, requirements, benefits', () => {
  const about = read('src/panel/AboutJob.tsx')
  for (const label of ['Empresa', 'Cidade', 'Modelo', 'Salário', 'Horário', 'Descrição', 'Requisitos', 'Benefícios']) {
    assert.ok(about.includes(`'${label}'`), label)
  }
  const page = read('src/panel/ApplicationPage.tsx')
  assert.match(page, /<Section title="Sobre a vaga">/)
  assert.match(page, /getPanelJob\(response\.job_id\)/)
})

test('recruiters: only their own jobs (no recruiter filter), no new/edit job, team page hidden', () => {
  const jobs = read('src/panel/JobsPage.tsx')
  assert.match(jobs, /const recruiter = isAdmin \? \(params\.get\('recrutadora'\) \?\? ''\) : ''/)
  assert.match(jobs, /\{isAdmin \? \(\s*<PanelSelect label="Recrutadora"/)
  // Manual registration: a recruiter must pick one of their jobs.
  const dialog = read('src/panel/AddCandidateDialog.tsx')
  assert.match(dialog, /const jobRequired = getCurrentUser\(\)\?\.role !== 'admin'/)
  assert.match(dialog, /if \(jobRequired && !values\.job_id\) next\.job_id = 'Escolha uma das suas vagas\.'/)
  assert.match(jobs, /isAdmin \? \(\s*<button type="button" className=\{panelButton\.navy\} onClick=\{\(\) => setEditing\('new'\)\}>/)
  assert.match(read('src/panel/JobPage.tsx'), /\{isAdmin && job\.status !== 'archived' \? \(/)
})

test('manual registration and referral reuse the API rules', () => {
  const dialog = read('src/panel/AddCandidateDialog.tsx')
  assert.match(dialog, /O candidato autorizou o uso dos dados dele pela AK Talent/)
  assert.match(dialog, /authorization_confirmed: true/)
  assert.match(read('src/panel/panelApi.ts'), /`\/panel\/applications\/\$\{applicationId\}\/refer`/)
  assert.match(read('src/panel/ReferDialog.tsx'), /A candidatura atual não muda\./)
})

test('candidates list: phone masked to the last digits, stage filters with the pipeline names', () => {
  assert.equal(maskPhone('41 99876-1203'), '(41) 9••••-1203')
  assert.equal(maskPhone('+55 (41) 99876-1203'), '(41) 9••••-1203')
  assert.equal(maskPhone('98761203'), '9••••-1203')
  assert.equal(maskPhone('123'), '••••')
  assert.equal(maskPhone(null), '—')
  assert.equal(CANDIDATE_STAGE_FILTERS[0].value, '')
  assert.equal(CANDIDATE_STAGE_FILTERS.at(-1)?.value, 'none')
  for (const option of CANDIDATE_STAGE_FILTERS.slice(1, -1)) {
    assert.equal(AK_STAGE_LABELS[option.value as keyof typeof AK_STAGE_LABELS], option.label, option.value)
    assert.ok(STAGE_TONES[option.value], option.value)
  }
})

test('LGPD erasure: strong confirmation, cannot be undone, admin only', () => {
  assert.equal(erasureConfirmed('  marcos TEIXEIRA ', 'Marcos Teixeira'), true)
  assert.equal(erasureConfirmed('Marcos', 'Marcos Teixeira'), false)
  assert.equal(erasureConfirmed('   ', '  '), false)
  const dialog = read('src/panel/CandidateDialogs.tsx')
  assert.match(dialog, /Esta ação não pode ser desfeita\./)
  assert.match(dialog, /Entendi que não dá para desfazer\./)
  assert.match(dialog, /const ready = understood && erasureConfirmed\(typed, candidate\.name\)/)
  assert.match(dialog, /disabled=\{!ready \|\| saving\}/)
  for (const page of ['src/panel/CandidatesPage.tsx', 'src/panel/CandidateProfilePage.tsx']) {
    assert.match(read(page), /isAdmin \? \[?\{? ?label: 'Excluir dados \(LGPD\)'|if \(isAdmin\) \{\s*list\.push\(\{ label: 'Excluir dados \(LGPD\)'/, page)
  }
})

test('stage 3 routes: Empresas, Candidatos, Recrutadoras and a panel 404', () => {
  const routes = read('src/routes/AppRoutes.tsx')
  for (const path of ['/painel/empresas', '/painel/candidatos', '/painel/candidatos/:candidateId', '/painel/recrutadoras', '/painel/recrutadoras/:userId', '/painel/*']) {
    assert.ok(routes.includes(`path="${path}"`), path)
  }
  assert.doesNotMatch(routes, /ComingSoonPage/)
  assert.ok(panelMenu('admin').main.concat(panelMenu('admin').admin).every((item) => !('soon' in item)))
})

test('recruiters: companies read-only, no team pages; nobody deactivates themselves', () => {
  const companies = read('src/panel/CompaniesPage.tsx')
  assert.match(companies, /if \(!isAdmin\) return list/)
  assert.match(companies, /\(company\.jobs_count \?\? 0\) === 0 && !company\.has_account/)
  const team = read('src/panel/TeamPages.tsx')
  assert.equal(team.match(/if \(!isAdmin\) return <p className="text-sm text-ink-600">\{ADMIN_ONLY\}<\/p>/g)?.length, 2)
  assert.match(team, /if \(member\.id !== selfId\) list\.push/)
})
