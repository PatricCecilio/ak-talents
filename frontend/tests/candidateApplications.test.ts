import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('candidate area starts with "Minhas candidaturas" and refreshes after applying', () => {
  const page = read('src/pages/CandidatePage.tsx')
  assert.match(page, /<MyApplicationsSection refreshKey=\{applicationsRefreshKey\} \/>/)
  assert.match(page, /setApplicationsRefreshKey\(\(key\) => key \+ 1\)/)
  assert.match(read('src/services/candidatePipelineService.ts'), /'\/candidates\/me\/applications'/)
})

test('friendly states: timeline while in progress, celebration when hired, closed message otherwise', () => {
  const section = read('src/components/candidate/MyApplicationsSection.tsx')
  assert.match(section, /item\.outcome === 'in_progress' && item\.step/)
  assert.match(section, /item\.outcome === 'hired'/)
  assert.match(section, /item\.outcome === 'closed'/)
  assert.match(section, /aria-current=\{active \? 'step' : undefined\}/)
  assert.match(section, /Você ainda não se candidatou a nenhuma vaga\./)
  // Status words come from the API mapping; the screen never shows internal stage names.
  assert.doesNotMatch(section, /finalist|ak_interview|client_approved|screening_status|finalist_summary/)
})

test('company name only when the API sends it', () => {
  const section = read('src/components/candidate/MyApplicationsSection.tsx')
  assert.match(section, /\[item\.company_name, item\.job_location\]\.filter\(Boolean\)/)
})

test('candidate screens use the landing look', () => {
  assert.doesNotMatch(read('src/components/candidate/MyApplicationsSection.tsx'), /components\/ui'/)
})
