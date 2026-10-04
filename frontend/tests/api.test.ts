import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { resolveApiBaseUrl } from '../src/services/api.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

test('api base URL accepts VITE_API_BASE_URL from Vite env', () => {
  assert.equal(
    resolveApiBaseUrl({ VITE_API_BASE_URL: 'https://backend.example.test' } as ImportMetaEnv),
    'https://backend.example.test',
  )
})

test('api base URL falls back to localhost when VITE_API_BASE_URL is missing or empty', () => {
  assert.equal(resolveApiBaseUrl({} as ImportMetaEnv), 'http://localhost:8000')
  assert.equal(resolveApiBaseUrl({ VITE_API_BASE_URL: '' } as ImportMetaEnv), 'http://localhost:8000')
  assert.equal(resolveApiBaseUrl({ VITE_API_BASE_URL: '   ' } as ImportMetaEnv), 'http://localhost:8000')
})

test('frontend API config keeps the backend URL configurable without frontend secrets', () => {
  const api = read('src/services/api.ts')
  const envExample = read('.env.example')

  assert.match(api, /VITE_API_BASE_URL/)
  assert.match(envExample, /VITE_API_BASE_URL=/)
  assert.doesNotMatch(api, /api\.aktalent\.com\.br/)
  assert.doesNotMatch(envExample, /api\.aktalent\.com\.br/)
  assert.doesNotMatch(`${api}\n${envExample}`, /DATABASE_URL|JWT_SECRET|APPINTELLI_INTEGRATION_SECRET/)
})
