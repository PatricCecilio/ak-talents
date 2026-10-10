import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { formatCompanyStatus, formatJobStatus, formatWorkMode } from '../src/services/jobFormat.ts'

const root = new URL('../', import.meta.url)
const srcDir = new URL('src/', root)

function screenFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return screenFiles(path)
    return name.endsWith('.tsx') ? [path] : []
  })
}

// Words that only appear on screen without their accent by mistake.
const UNACCENTED = /\b(usuarios?|responsavel|descricao|recomendacoes|experiencia|comecar|titulo|salario|minimo|maximo|hibrido|nao|voce|possivel|aprovacao|localizacao|configuracao|pretensao|pagina|obrigatorios|desejaveis|funcionarios|trajetoria|informacoes|Sao Paulo)\b/i

function visibleLines(source: string): string[] {
  return source
    .split('\n')
    .filter((line) => !/^\s*(import |\/\/|\/\*|\*)/.test(line))
}

test('no unaccented Portuguese words on the screens', () => {
  const offenders: string[] = []
  for (const file of screenFiles(srcDir.pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
    visibleLines(readFileSync(file, 'utf8')).forEach((line, index) => {
      if (UNACCENTED.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim()}`)
    })
  }
  assert.deepEqual(offenders, [])
})

test('statuses and work modes reach the screen as Portuguese labels', () => {
  assert.equal(formatWorkMode('onsite'), 'Presencial')
  assert.equal(formatJobStatus('pending'), 'Aguardando aprovação')
  assert.equal(formatJobStatus('closed'), 'Encerrada')
  assert.equal(formatCompanyStatus('blocked'), 'Bloqueada')

  const read = (path: string) => readFileSync(new URL(path, root), 'utf8')
  const admin = read('src/pages/AdminPage.tsx')
  assert.match(admin, /Triagem: \{formatScreeningStatus\(application\.screening_status\)\}/)
  assert.match(admin, /label=\{formatJobStatus\(job\.status\)\}/)
  assert.doesNotMatch(admin, /\{status\}<\/Badge>/)
  assert.match(read('src/pages/HomePage.tsx'), /workMode: formatWorkMode\(job\.work_mode\)/)
  assert.match(read('src/pages/CandidatePage.tsx'), /formatWorkMode\(job\.work_mode\)/)
})

test('dashboard menu is in Portuguese and every item goes somewhere', () => {
  const read = (path: string) => readFileSync(new URL(path, root), 'utf8')
  const shell = read('src/layouts/DashboardShell.tsx')
  assert.doesNotMatch(shell, /'Company'|'Matches'|capitalize/)
  assert.match(shell, /admin: 'Administração'/)

  const pages = { '#finalistas': 'CompanyPage', '#nova-vaga': 'CompanyPage', '#suas-vagas': 'CompanyPage', '#candidaturas': 'CandidatePage', '#perfil': 'CandidatePage', '#resumo': 'AdminPage', '#empresas': 'AdminPage', '#candidatos': 'AdminPage' }
  for (const [href, page] of Object.entries(pages)) {
    assert.match(shell, new RegExp(`href: '${href}'`))
    assert.match(read(`src/pages/${page}.tsx`), new RegExp(`id="${href.slice(1)}"`), `${page} sem ${href}`)
  }
})
