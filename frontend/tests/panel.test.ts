import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  BOARD_COLUMNS,
  COLUMN_TITLES,
  EXIT_STAGES,
  cardSubtitle,
  daysAgo,
  greeting,
  initials,
  jobsQuery,
  jobStatus,
  longDate,
  panelMenu,
  publicJobUrl,
  publishedFor,
  relativeTime,
  shortAge,
} from '../src/panel/panelFormat.ts'

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

test('/painel lives next to /admin and /recrutador (no redirect yet), private to the team, noindex', () => {
  const routes = read('src/routes/AppRoutes.tsx')
  assert.match(routes, /<PrivateRoute allowedRoles=\{\['recruiter', 'admin'\]\}>\s*<PanelLayout \/>/)
  for (const path of ['/painel', '/painel/vagas', '/painel/vagas/:jobId', '/painel/candidaturas/:applicationId']) {
    assert.ok(routes.includes(`path="${path}"`), path)
  }
  assert.match(routes, /path="\/admin"/)
  assert.match(routes, /path="\/recrutador"/)
  assert.doesNotMatch(routes, /Navigate to="\/painel/)
  const layout = read('src/panel/PanelLayout.tsx')
  assert.match(layout, /<meta name="robots" content="noindex, nofollow" \/>/)
  // Desktop: the page never scrolls; phones: normal scroll with a ☰ menu.
  assert.match(layout, /xl:h-svh xl:overflow-hidden/)
  assert.match(layout, /aria-label="Abrir menu"/)
})

test('recruiters: own jobs by default, no new/edit job, team page hidden', () => {
  const jobs = read('src/panel/JobsPage.tsx')
  assert.match(jobs, /params\.get\('recrutadora'\) \?\? \(isAdmin \? '' : 'minhas'\)/)
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
