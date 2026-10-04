import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, extractErrorMessage, NETWORK_ERROR_MESSAGE } from '../src/services/api.ts'
import { resolveFeaturedJobsMode } from '../src/services/featuredJobs.ts'
import { formatSalary, formatWorkMode } from '../src/services/jobFormat.ts'
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
