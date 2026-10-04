import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  AK_STAGE_LABELS,
  CLOSED_STAGES,
  PIPELINE_COLUMNS,
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
  assert.match(dialog, /toStage === 'hired' && otherActiveCount > 0/)
  assert.match(dialog, /Sim, mover todos/)
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
