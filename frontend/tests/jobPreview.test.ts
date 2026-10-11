import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildJobPreviewMeta, injectPreviewMeta, renderJobPreview } from '../src/services/jobPreviewMeta.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')
const indexHtml = read('index.html')

const job = {
  title: 'Atendente de loja',
  slug: 'atendente-de-loja',
  location: 'Curitiba, PR',
  salary_min: 1800,
  salary_max: 2200,
  contract_type: 'clt',
  description: 'Atender clientes no balcão, organizar a loja, operar o caixa e repor produtos.',
}

const tag = (html: string, pattern: RegExp) => pattern.exec(html)?.[1]

test('title and description come from the job (salary and contract first)', () => {
  const meta = buildJobPreviewMeta(job)
  assert.equal(meta.title, 'Atendente de loja – Curitiba, PR | AK Talent')
  assert.equal(meta.description, 'R$ 1.800 a R$ 2.200 · CLT. Atender clientes no balcão, organizar a loja, operar o caixa e repor produtos.')
  assert.equal(meta.url, 'https://www.aktalent.com.br/vagas/atendente-de-loja')

  const bare = buildJobPreviewMeta({ title: 'Repositor', slug: 'repositor', description: '' })
  assert.equal(bare.title, 'Repositor | AK Talent')
  assert.equal(bare.description, 'Veja os detalhes da vaga e candidate-se pelo site da AK Talent.')

  const long = buildJobPreviewMeta({ ...job, description: 'palavra '.repeat(80) })
  assert.ok(long.description.length <= 160, String(long.description.length))
  assert.ok(long.description.endsWith('…'))
})

test('injected into the real index.html, escaped, every preview tag replaced', () => {
  const meta = buildJobPreviewMeta({ ...job, title: 'Caixa "noturno" <b>&</b>' })
  const html = injectPreviewMeta(indexHtml, meta)
  assert.equal(tag(html, /<title>([^<]*)<\/title>/), 'Caixa &quot;noturno&quot; &lt;b&gt;&amp;&lt;/b&gt; – Curitiba, PR | AK Talent')
  assert.equal(tag(html, /property="og:title" content="([^"]*)"/), 'Caixa &quot;noturno&quot; &lt;b&gt;&amp;&lt;/b&gt; – Curitiba, PR | AK Talent')
  for (const pattern of [
    /name="description"\s+content="([^"]*)"/,
    /property="og:description"\s+content="([^"]*)"/,
    /name="twitter:description"\s+content="([^"]*)"/,
  ]) {
    assert.equal(tag(html, pattern), meta.description, String(pattern))
  }
  assert.equal(tag(html, /property="og:url" content="([^"]*)"/), meta.url)
  assert.match(tag(html, /name="twitter:title" content="([^"]*)"/) ?? '', /Curitiba, PR \| AK Talent$/)
  // The brand image stays.
  assert.match(html, /property="og:image" content="https:\/\/www\.aktalent\.com\.br\/og-image\.png"/)
})

type Call = { url: string; signal?: AbortSignal }
function fakeFetch(apiAnswer: () => Promise<{ ok: boolean; body?: unknown }>) {
  const calls: Call[] = []
  const impl = async (url: string, init?: { signal?: AbortSignal }) => {
    calls.push({ url, signal: init?.signal })
    if (url.endsWith('/index.html')) return { ok: true, json: async () => null, text: async () => indexHtml }
    const answer = await apiAnswer()
    return { ok: answer.ok, json: async () => answer.body, text: async () => '' }
  }
  return { impl, calls }
}

test('robot request: job found -> job tags; anything else -> the plain site preview, never an error', async () => {
  const base = { siteOrigin: 'https://www.aktalent.com.br', apiBase: 'https://api.example/' }

  const found = fakeFetch(async () => ({ ok: true, body: job }))
  const html = await renderJobPreview({ ...base, slug: 'atendente-de-loja', fetchImpl: found.impl })
  assert.equal(tag(html, /<title>([^<]*)<\/title>/), 'Atendente de loja – Curitiba, PR | AK Talent')
  assert.ok(found.calls.some((call) => call.url === 'https://api.example/jobs/atendente-de-loja' && call.signal))

  const closed = fakeFetch(async () => ({ ok: false }))
  assert.equal(await renderJobPreview({ ...base, slug: 'vaga-encerrada', fetchImpl: closed.impl }), indexHtml)

  const broken = fakeFetch(async () => {
    throw new Error('API dormindo')
  })
  assert.equal(await renderJobPreview({ ...base, slug: 'atendente-de-loja', fetchImpl: broken.impl }), indexHtml)

  const slow = fakeFetch(() => new Promise((resolve) => setTimeout(() => resolve({ ok: true, body: job }), 500)))
  const slowImpl = async (url: string, init?: { signal?: AbortSignal }) => {
    if (!url.endsWith('/index.html') && init?.signal) {
      return await new Promise<never>((_, reject) => init.signal!.addEventListener('abort', () => reject(new Error('timeout'))))
    }
    return slow.impl(url, init)
  }
  assert.equal(await renderJobPreview({ ...base, slug: 'atendente-de-loja', fetchImpl: slowImpl, timeoutMs: 50 }), indexHtml)

  const invalid = fakeFetch(async () => ({ ok: true, body: job }))
  assert.equal(await renderJobPreview({ ...base, slug: '../admin', fetchImpl: invalid.impl }), indexHtml)
  assert.equal(invalid.calls.length, 1, 'slug inválido nem chama a API')

  const noApi = fakeFetch(async () => ({ ok: true, body: job }))
  assert.equal(await renderJobPreview({ ...base, apiBase: '', slug: 'atendente-de-loja', fetchImpl: noApi.impl }), indexHtml)
})

test('only link-preview robots are routed to the function; people keep the static site', () => {
  const config = JSON.parse(read('vercel.json'))
  const [botRule, catchAll] = config.rewrites
  assert.equal(botRule.source, '/vagas/:slug')
  assert.equal(botRule.destination, '/api/vaga-preview?slug=:slug')
  const agents = new RegExp(botRule.has[0].value)
  assert.equal(botRule.has[0].key, 'user-agent')
  for (const robot of [
    'WhatsApp/2.23.20.0 A',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'LinkedInBot/1.0 (compatible; Mozilla/5.0)',
    'Twitterbot/1.0',
    'TelegramBot (like TwitterBot)',
  ]) {
    assert.ok(agents.test(robot), robot)
  }
  for (const person of [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
  ]) {
    assert.equal(agents.test(person), false, person)
  }
  // The SPA fallback must not swallow /api/* (it did: the function was never reached).
  assert.deepEqual(catchAll, { source: '/((?!api/).*)', destination: '/index.html' })
  const spa = new RegExp(`^${catchAll.source}$`)
  assert.equal(spa.test('/api/vaga-preview'), false)
  for (const path of ['/', '/vagas', '/vagas/atendente', '/entrar/empresa', '/equipe', '/apidoc']) assert.ok(spa.test(path), path)

  const handler = read('api/vaga-preview.ts')
  assert.match(handler, /renderJobPreview\(/)
  assert.match(handler, /s-maxage=300/)
  assert.match(read('src/pages/JobDetailPage.tsx'), /document\.title = meta\.title/)
})
