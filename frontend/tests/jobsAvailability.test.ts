import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { ApiError, extractErrorMessage, NETWORK_ERROR_MESSAGE } from '../src/services/api.ts'
import { resolveFeaturedJobsMode } from '../src/services/featuredJobs.ts'
import { formatContractType, formatOpenings, formatSalary, formatWorkMode, jobHighlights } from '../src/services/jobFormat.ts'
import { resolveWhatsappConfig } from '../src/services/whatsapp.ts'

test('featured jobs: real jobs always win', () => {
  assert.equal(resolveFeaturedJobsMode(3, false), 'live')
  assert.equal(resolveFeaturedJobsMode(3, true), 'live')
})

test('featured jobs: production never shows sample jobs when empty or API is down', () => {
  assert.equal(resolveFeaturedJobsMode(0, false), 'unavailable')
  assert.equal(resolveFeaturedJobsMode(null, false), 'unavailable')
})

test('featured jobs: sample jobs only in local development', () => {
  assert.equal(resolveFeaturedJobsMode(0, true), 'demo')
  assert.equal(resolveFeaturedJobsMode(null, true), 'demo')
})

test('ApiError exposes network and not-found states', () => {
  assert.equal(new ApiError(0, NETWORK_ERROR_MESSAGE).isNetworkError, true)
  assert.equal(new ApiError(404, 'x').isNotFound, true)
  assert.equal(new ApiError(500, 'x').isNetworkError, false)
  assert.ok(new ApiError(500, 'x') instanceof Error)
  assert.doesNotMatch(NETWORK_ERROR_MESSAGE, /Failed to fetch/)
})

test('error messages: string detail, validation list and fallback', () => {
  assert.equal(extractErrorMessage('Usuário inativo.'), 'Usuário inativo.')
  assert.equal(
    extractErrorMessage([{ msg: 'Value error, O salário mínimo não pode ser maior que o salário máximo.' }]),
    'O salário mínimo não pode ser maior que o salário máximo.',
  )
  assert.match(extractErrorMessage(null), /Não foi possível concluir a solicitação/)
  assert.match(extractErrorMessage([]), /Não foi possível concluir a solicitação/)
})

test('WhatsApp link only when an https URL is configured', () => {
  assert.equal(resolveWhatsappConfig({} as ImportMetaEnv).url, '')
  assert.equal(resolveWhatsappConfig({ VITE_WHATSAPP_URL: 'javascript:alert(1)' } as ImportMetaEnv).url, '')
  assert.equal(
    resolveWhatsappConfig({ VITE_WHATSAPP_URL: ' https://wa.me/5541999999999 ' } as ImportMetaEnv).url,
    'https://wa.me/5541999999999',
  )
  assert.doesNotMatch(resolveWhatsappConfig({} as ImportMetaEnv).label, /especialista/)
})

test('job formatting uses friendly Portuguese labels', () => {
  assert.equal(formatWorkMode('remote'), 'Remoto')
  assert.equal(formatWorkMode('hybrid'), 'Híbrido')
  assert.equal(formatWorkMode('onsite'), 'Presencial')
  assert.equal(formatWorkMode(null), '')
  assert.equal(formatSalary({ salary_min: null, salary_max: 3000 }), `Até R$ ${(3000).toLocaleString('pt-BR')}`)
})

test('job lists show a visible loading state and explain a slow first load', () => {
  const root = new URL('../', import.meta.url)
  const read = (path: string) => readFileSync(new URL(path, root), 'utf8')
  const loading = read('src/components/JobsLoading.tsx')

  assert.match(loading, /role="status"/)
  assert.match(loading, /SLOW_LOADING_AFTER_MS = 3000/)
  assert.match(loading, /A primeira visita do dia pode levar alguns segundos\./)
  assert.match(read('src/pages/JobsPage.tsx'), /loadState === 'loading' \? <JobsLoading \/> : null/)
  assert.match(read('src/pages/JobDetailPage.tsx'), /<JobsLoading label="Carregando vaga\.\.\." count=\{1\} \/>/)
  assert.match(read('src/pages/HomePage.tsx'), /<LoadingHint label="Carregando vagas\.\.\." \/>/)
})

test('job highlights: what candidates want first, only what was filled in', () => {
  const full = {
    salary_min: 1800,
    salary_max: 2200,
    contract_type: 'clt' as const,
    schedule: 'Seg a sáb, 6x1',
    work_mode: 'onsite',
    openings: 2,
    benefits: 'Vale-transporte',
  }
  assert.deepEqual(
    jobHighlights(full).map((item) => item.label),
    ['Salário', 'Contrato', 'Horário ou escala', 'Modelo', 'Vagas', 'Benefícios'],
  )
  assert.equal(jobHighlights(full)[1].value, 'CLT')
  assert.equal(jobHighlights(full)[4].value, '2 vagas')
  assert.equal(formatOpenings(1), '1 vaga')
  assert.equal(formatContractType('internship'), 'Estágio')
  assert.equal(formatContractType('temporary'), 'Temporário')

  const bare = { salary_min: null, salary_max: null, contract_type: null, schedule: '  ', work_mode: null, openings: null, benefits: null }
  assert.deepEqual(jobHighlights(bare), [])
})

test('the job page shows the highlights first and the company form collects them', () => {
  const root = new URL('../', import.meta.url)
  const read = (path: string) => readFileSync(new URL(path, root), 'utf8')
  const page = read('src/pages/JobDetailPage.tsx')
  assert.match(page, /aria-label="Resumo da vaga"/)
  assert.ok(page.indexOf('Resumo da vaga') < page.indexOf('>Descrição</h2>'))

  const company = read('src/pages/CompanyPage.tsx')
  for (const id of ['contract_type', 'openings', 'schedule', 'benefits']) {
    assert.match(company, new RegExp(`id="${id}"`), id)
  }
  assert.match(company, /openings: toOptionalNumber\(values\.openings\)/)
  assert.match(read('src/pages/JobsPage.tsx'), /formatContractType\(job\.contract_type\)/)
})
