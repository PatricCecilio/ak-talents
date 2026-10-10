import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { hireDefaults, moveResultNote, otherActivePhrase } from '../src/services/hireDefaults.ts'
import {
  AK_STAGE_LABELS,
  CLOSED_STAGES,
  PIPELINE_COLUMNS,
  finalistWaitingLabel,
  formatDaysAgo,
  formatScreeningStatus,
  whatsappLink,
} from '../src/services/pipelineFormat.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('stage labels on screen match the backend pipeline labels', () => {
  const backend = read('../backend/app/core/pipeline.py')
  const labels = Object.fromEntries([...backend.matchAll(/Stage\.(\w+): "([^"]+)"/g)].map((match) => [match[1], match[2]]))
  assert.deepEqual(AK_STAGE_LABELS, labels)
  assert.deepEqual([...PIPELINE_COLUMNS, ...CLOSED_STAGES].sort(), Object.keys(labels).sort())
})

test('friendly date, screening and WhatsApp helpers', () => {
  const now = new Date(2026, 9, 10, 15, 0)
  assert.equal(formatDaysAgo(new Date(2026, 9, 10, 8, 0).toISOString(), now), 'hoje')
  assert.equal(formatDaysAgo(new Date(2026, 9, 9, 23, 0).toISOString(), now), 'ontem')
  assert.equal(formatDaysAgo(new Date(2026, 9, 5, 9, 0).toISOString(), now), 'há 5 dias')
  assert.equal(formatScreeningStatus('QUALIFIED'), 'Atende aos requisitos')
  assert.equal(formatScreeningStatus('pending_screening'), 'Triagem não respondida')
  assert.equal(formatScreeningStatus('NO_QUESTIONS'), 'Sem perguntas de triagem')
  assert.equal(whatsappLink('(41) 99111-0002'), 'https://wa.me/5541991110002')
  assert.equal(whatsappLink('5541991110002'), 'https://wa.me/5541991110002')
  assert.equal(whatsappLink('123'), '')
})

test('recruiter area routes: home, job pipeline and application detail', () => {
  const routes = read('src/routes/AppRoutes.tsx')
  assert.match(routes, /path="\/recrutador\/vagas\/:jobId" element=\{<RecruiterJobPage \/>\}/)
  assert.match(routes, /path="\/recrutador\/candidaturas\/:applicationId" element=\{<RecruiterApplicationPage \/>\}/)
})

test('home highlights finalists waiting for the client and shows counts per stage', () => {
  const home = read('src/pages/recruiter/RecruiterHomePage.tsx')
  assert.match(home, /getRecruiterJobs\(\)/)
  assert.match(home, /aguardam`\} o cliente há mais de \{alertDays\} dias/)
  assert.match(home, /job\.stage_counts\[stage\]/)
})

test('pipeline: columns on desktop, stage filter list on phones, "Mover para…" button', () => {
  const page = read('src/pages/recruiter/RecruiterJobPage.tsx')
  assert.match(page, /lg:hidden/)
  assert.match(page, /hidden lg:block/)
  assert.match(page, /role="tablist" aria-label="Filtrar por etapa"/)
  assert.match(page, /Mover para…/)
  assert.doesNotMatch(page, /draggable|onDrag/)
})

test('move dialog: finalist needs a summary, hiring can close the others after confirmation', () => {
  const dialog = read('src/components/recruiter/MoveStageDialog.tsx')
  assert.match(dialog, /finalist_summary: isFinalist \? finalistSummary : undefined/)
  assert.match(dialog, /Parecer para a empresa \(obrigatório\)/)
  assert.match(dialog, /const isHiring = toStage === 'hired'/)
  assert.match(dialog, /isHiring && otherActiveCount > 0/)
  assert.match(dialog, /Sim, confirmar/)
  assert.match(dialog, /Vaga preenchida/)
  assert.match(dialog, /role="dialog"/)
})

test('application detail shows contact, screening, history and internal notes', () => {
  const detail = read('src/pages/recruiter/RecruiterApplicationPage.tsx')
  for (const text of ['Contato', 'Triagem', 'Histórico', 'Notas internas', 'Só a equipe AK Talent vê estas notas']) {
    assert.ok(detail.includes(text), text)
  }
  assert.match(detail, /addApplicationNote\(/)
})

test('recruiter screens use the landing look', () => {
  for (const path of [
    'src/pages/recruiter/RecruiterJobPage.tsx',
    'src/pages/recruiter/RecruiterApplicationPage.tsx',
    'src/components/recruiter/MoveStageDialog.tsx',
  ]) {
    assert.doesNotMatch(read(path), /components\/ui'/, path)
  }
})

test('hiring defaults follow the number of positions', () => {
  assert.deepEqual(hireDefaults(null), { closeOthers: true, closeJob: true })
  assert.deepEqual(hireDefaults(undefined), { closeOthers: true, closeJob: true })
  assert.deepEqual(hireDefaults(1), { closeOthers: true, closeJob: true })
  assert.deepEqual(hireDefaults(2), { closeOthers: false, closeJob: false })
  assert.deepEqual(hireDefaults(10), { closeOthers: false, closeJob: false })
  assert.equal(otherActivePhrase(1), 'o outro candidato ativo')
  assert.equal(otherActivePhrase(3), 'os outros 3 candidatos ativos')
  assert.equal(moveResultNote(0, false), '')
  assert.equal(moveResultNote(1, true), ' 1 outro candidato foi encerrado (Vaga preenchida). A vaga foi encerrada e saiu do site.')
  assert.equal(moveResultNote(2, false), ' 2 outros candidatos foram encerrados (Vaga preenchida).')
})

test('the hire dialog uses those defaults and asks what to do with the job', () => {
  const dialog = read('src/components/recruiter/MoveStageDialog.tsx')
  assert.match(dialog, /const defaults = hireDefaults\(openings\)/)
  assert.match(dialog, /useState\(defaults\.closeOthers\)/)
  assert.match(dialog, /useState\(defaults\.closeJob\)/)
  assert.match(dialog, /E a vaga\?/)
  assert.match(dialog, /Encerrar a vaga \(sai do site\)/)
  assert.match(dialog, /Manter aberta \(há mais posições\)/)
  assert.match(dialog, /close_job: willCloseJob \? true : undefined/)
  assert.match(read('src/pages/recruiter/RecruiterJobPage.tsx'), /openings=\{job\.openings\}/)
  assert.match(read('src/pages/recruiter/RecruiterApplicationPage.tsx'), /openings=\{detail\.job_openings\}/)
})

test('finalists show how long the client company has been deciding', () => {
  const now = new Date(2026, 9, 10, 15, 0)
  assert.equal(finalistWaitingLabel(new Date(2026, 9, 10, 9, 0).toISOString(), now), 'Aguardando a empresa desde hoje')
  assert.equal(finalistWaitingLabel(new Date(2026, 9, 9, 9, 0).toISOString(), now), 'Aguardando a empresa há 1 dia')
  assert.equal(finalistWaitingLabel(new Date(2026, 9, 6, 9, 0).toISOString(), now), 'Aguardando a empresa há 4 dias')

  const page = read('src/pages/recruiter/RecruiterJobPage.tsx')
  assert.match(page, /card\.stage === 'finalist' \? \(/)
  assert.match(page, /\{finalistWaitingLabel\(card\.stage_updated_at\)\}/)
  assert.match(page, /card\.waiting_client_too_long \? ' · cobrar retorno' : ''/)

  const dialog = read('src/components/recruiter/MoveStageDialog.tsx')
  assert.match(dialog, /currentStage === 'finalist' \? \(/)
  assert.match(dialog, /Aguardando a decisão da empresa\{companyName \? <strong> \{companyName\}<\/strong> : null\}/)
  assert.match(page, /companyName=\{job\.company_name\}/)
  assert.match(read('src/pages/recruiter/RecruiterApplicationPage.tsx'), /companyName=\{detail\.company_name\}/)
})

test('possible duplicates are flagged on the card and the detail, without blocking', () => {
  const page = read('src/pages/recruiter/RecruiterJobPage.tsx')
  assert.match(page, /\{card\.possible_duplicate \? <DuplicateBadge \/> : null\}/)
  assert.match(page, /Possível duplicado/)
  const detail = read('src/pages/recruiter/RecruiterApplicationPage.tsx')
  assert.match(detail, /detail\.possible_duplicate \? \(/)
  assert.match(detail, /nada foi bloqueado/)
})
