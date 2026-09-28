// AK Talent CTAs -> AppIntelli public widget API. Runs with `npm test` (node:test, native TS).
// No network, no AppIntelli writes: the widget API is a fake object that records `open` calls.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import type { AppIntelliApi, AppIntelliOpenOptions } from '../src/types/appIntelli.ts'
import { appIntelliCtas, openAppIntelli, type AppIntelliCta } from '../src/services/appIntelliWidget.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/g, '\n')
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function fakeHost() {
  const calls: AppIntelliOpenOptions[] = []
  const api: AppIntelliApi = {
    open: (options) => {
      calls.push(options ?? {})
    },
    close: () => {},
  }
  return { host: { AppIntelli: api }, calls }
}

function expectedContext(cta: AppIntelliCta) {
  return {
    context: {
      intentHint: cta.intentHint,
      entryPoint: cta.entryPoint,
      pageSection: cta.pageSection,
      journeyStage: cta.journeyStage,
      metadata: { ctaLabel: cta.ctaLabel },
    },
  }
}

test('T1-T6: "Quero contratar" opens AppIntelli exactly once with the hiring hero context', () => {
  const { host, calls } = fakeHost()
  assert.equal(openAppIntelli(appIntelliCtas.heroHiring, { host }), 'opened')
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], {
    context: {
      intentHint: 'hiring',
      entryPoint: 'hero_company',
      pageSection: 'hero',
      journeyStage: 'consideration',
      metadata: { ctaLabel: 'Quero contratar' },
    },
  })
})

test('T7-T9: "Busco oportunidades" opens AppIntelli exactly once with the job seeker hero context', () => {
  const { host, calls } = fakeHost()
  openAppIntelli(appIntelliCtas.heroJobSeeker, { host })
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], {
    context: {
      intentHint: 'job_seeker',
      entryPoint: 'hero_professional',
      pageSection: 'hero',
      journeyStage: 'consideration',
      metadata: { ctaLabel: 'Busco oportunidades' },
    },
  })
})

test('T10: header "Falar com a AK Talent" uses the neutral general_contact context', () => {
  const { host, calls } = fakeHost()
  openAppIntelli(appIntelliCtas.headerContact, { host })
  assert.deepEqual(calls[0], expectedContext(appIntelliCtas.headerContact))
  assert.equal(calls[0].context?.intentHint, 'general_contact')
  assert.equal(calls[0].context?.entryPoint, 'header_contact')
  assert.equal(calls[0].context?.pageSection, 'header')
})

test('section and final CTAs carry their own contexts', () => {
  assert.deepEqual(appIntelliCtas.companySection, {
    intentHint: 'hiring',
    entryPoint: 'company_section',
    pageSection: 'companies',
    journeyStage: 'consideration',
    ctaLabel: 'Quero contratar',
  })
  assert.deepEqual(appIntelliCtas.professionalSection, {
    intentHint: 'job_seeker',
    entryPoint: 'professional_section',
    pageSection: 'professionals',
    journeyStage: 'consideration',
    ctaLabel: 'Apresentar meu perfil',
  })
  assert.deepEqual(appIntelliCtas.finalContact, {
    intentHint: 'general_contact',
    entryPoint: 'final_cta',
    pageSection: 'final_cta',
    journeyStage: 'decision',
    ctaLabel: 'Falar com a AK Talent',
  })
})

test('T14: early click before widget.js loads waits, then opens once with the latest click context', async () => {
  const host: { AppIntelli?: AppIntelliApi } = {}
  assert.equal(openAppIntelli(appIntelliCtas.heroHiring, { host, pollMs: 5, waitMs: 500 }), 'waiting')
  assert.equal(openAppIntelli(appIntelliCtas.heroJobSeeker, { host, pollMs: 5, waitMs: 500 }), 'waiting')
  const { host: ready, calls } = fakeHost()
  await sleep(30)
  host.AppIntelli = ready.AppIntelli
  await sleep(60)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], expectedContext(appIntelliCtas.heroJobSeeker))
})

test('T14: widget never loading gives up quietly (no throw, no open)', async () => {
  const host: { AppIntelli?: AppIntelliApi } = {}
  const warn = console.warn
  const warnings: unknown[] = []
  console.warn = (...args: unknown[]) => warnings.push(args)
  try {
    assert.equal(openAppIntelli(appIntelliCtas.finalContact, { host, pollMs: 5, waitMs: 30 }), 'waiting')
    await sleep(80)
  } finally {
    console.warn = warn
  }
  assert.equal(warnings.length, 1)
})

test('a widget API that throws never breaks the page', () => {
  const host = {
    AppIntelli: {
      open: () => {
        throw new Error('boom')
      },
      close: () => {},
    },
  }
  assert.equal(openAppIntelli(appIntelliCtas.heroHiring, { host }), 'unavailable')
})

test('T11/T12: AK Talent code only uses the public API (no messages, no conversation endpoint, no iframe access)', () => {
  const files = readdirSync(new URL('src/', root), { recursive: true })
    .map(String)
    .filter((file) => /\.(ts|tsx)$/.test(file))
  const offenders = files.filter((file) =>
    /\/api\/widget|postMessage|contentWindow|contentDocument|conversations/.test(read(`src/${file.replace(/\\/g, '/')}`)),
  )
  assert.deepEqual(offenders, [])
  const service = read('src/services/appIntelliWidget.ts')
  assert.doesNotMatch(service, /fetch\(|message:|content:/)
})

test('CTAs are real buttons wired to the expected contexts; each landing CTA appears once', () => {
  const button = read('src/components/AppIntelliButton.tsx')
  assert.match(button, /<button\s+type="button"/)
  assert.match(button, /\{config\.ctaLabel\}/)
  const homePage = read('src/pages/HomePage.tsx')
  const header = read('src/components/Header.tsx')
  const count = (source: string, id: string) => (source.match(new RegExp(`cta="${id}"`, 'g')) ?? []).length
  for (const id of ['heroHiring', 'heroJobSeeker', 'companySection', 'professionalSection', 'finalContact']) {
    assert.equal(count(homePage, id), 1, id)
  }
  assert.equal(count(header, 'headerContact'), 1)
})

test('T13: menu stays navigation (anchor links, no chat buttons inside the nav)', () => {
  const header = read('src/components/Header.tsx')
  const nav = header.slice(header.indexOf('<nav'), header.indexOf('</nav>'))
  assert.match(nav, /<a\s/)
  assert.doesNotMatch(nav, /AppIntelliButton|onClick/)
  for (const href of ['#inicio', '#como-funciona', '#empresas', '#profissionais', '#sobre']) {
    assert.match(header, new RegExp(`href: '${href}'`))
  }
})

test('T15: exactly one AppIntelli widget installation remains', () => {
  const html = read('index.html')
  assert.equal((html.match(/https:\/\/www\.appintelli\.com\.br\/widget\.js/g) ?? []).length, 1)
  assert.equal((html.match(/data-widget-key=/g) ?? []).length, 1)
})
