// AK Talent CTAs -> AppIntelli public widget API. Runs with `npm test` (node:test, native TS).
// No network, no AppIntelli writes: the widget API is a fake object that records `open` calls.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import type { AppIntelliApi, AppIntelliOpenOptions } from '../src/types/appIntelli.ts'
import {
  appIntelliCtas,
  openAppIntelli,
  openAppIntelliOptions,
  toRecruitmentScreeningOpenOptions,
  type AppIntelliCta,
} from '../src/services/appIntelliWidget.ts'
import {
  DEFAULT_APPINTELLI_WIDGET_URL,
  installAppIntelliWidget,
  resolveAppIntelliWidgetConfig,
} from '../src/services/appIntelliWidgetLoader.ts'
import { isCommercialPath } from '../src/services/appIntelliRoutes.ts'

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

test('T1-T6: "Conversar com a AK Talent" opens AppIntelli exactly once with the hiring hero context', () => {
  const { host, calls } = fakeHost()
  assert.equal(openAppIntelli(appIntelliCtas.heroDemo, { host }), 'opened')
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], {
    context: {
      intentHint: 'hiring',
      entryPoint: 'hero_demo',
      pageSection: 'hero',
      journeyStage: 'consideration',
      metadata: { ctaLabel: 'Conversar com a AK Talent' },
    },
  })
})

test('T10: header contact context remains available but is not rendered as a header CTA', () => {
  const { host, calls } = fakeHost()
  openAppIntelli(appIntelliCtas.headerContact, { host })
  assert.deepEqual(calls[0], expectedContext(appIntelliCtas.headerContact))
  assert.equal(calls[0].context?.intentHint, 'general_contact')
  assert.equal(calls[0].context?.entryPoint, 'header_contact')
  assert.equal(calls[0].context?.pageSection, 'header')
  assert.doesNotMatch(read('src/components/Header.tsx'), /AppIntelliButton|headerContact/)
})

test('section and final CTAs carry their own contexts', () => {
  assert.deepEqual(appIntelliCtas.sectionDemo, {
    intentHint: 'hiring',
    entryPoint: 'solution_section',
    pageSection: 'solution',
    journeyStage: 'consideration',
    ctaLabel: 'Conversar com a AK Talent',
  })
  assert.deepEqual(appIntelliCtas.triageDemo, {
    intentHint: 'hiring',
    entryPoint: 'triage_section',
    pageSection: 'triage',
    journeyStage: 'consideration',
    ctaLabel: 'Conversar com a AK Talent',
  })
  assert.deepEqual(appIntelliCtas.benefitsDemo, {
    intentHint: 'hiring',
    entryPoint: 'benefits_section',
    pageSection: 'benefits',
    journeyStage: 'consideration',
    ctaLabel: 'Conversar com a AK Talent',
  })
  assert.deepEqual(appIntelliCtas.finalDemo, {
    intentHint: 'general_contact',
    entryPoint: 'final_cta',
    pageSection: 'final_cta',
    journeyStage: 'decision',
    ctaLabel: 'Conversar com a AK Talent',
  })
  assert.deepEqual(appIntelliCtas.floatingChat, {
    intentHint: 'general_contact',
    entryPoint: 'floating_chat',
    pageSection: 'floating_chat',
    journeyStage: 'consideration',
    ctaLabel: 'Conversar com a AK Talent',
  })
})

test('T14: early click before widget.js loads waits, then opens once with the latest click context', async () => {
  const host: { AppIntelli?: AppIntelliApi } = {}
  assert.equal(openAppIntelli(appIntelliCtas.heroDemo, { host, pollMs: 5, waitMs: 500 }), 'waiting')
  assert.equal(openAppIntelli(appIntelliCtas.sectionDemo, { host, pollMs: 5, waitMs: 500 }), 'waiting')
  const { host: ready, calls } = fakeHost()
  await sleep(30)
  host.AppIntelli = ready.AppIntelli
  await sleep(60)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], expectedContext(appIntelliCtas.sectionDemo))
})

test('T14: widget never loading gives up quietly (no throw, no open)', async () => {
  const host: { AppIntelli?: AppIntelliApi } = {}
  const error = console.error
  const errors: unknown[] = []
  console.error = (...args: unknown[]) => errors.push(args)
  try {
    assert.equal(openAppIntelli(appIntelliCtas.finalDemo, { host, pollMs: 5, waitMs: 30 }), 'waiting')
    await sleep(80)
  } finally {
    console.error = error
  }
  assert.equal(errors.length, 1)
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
  assert.equal(openAppIntelli(appIntelliCtas.heroDemo, { host }), 'unavailable')
})

test('recruitment screening opens AppIntelli with only the opaque application reference', () => {
  const { host, calls } = fakeHost()
  const options = toRecruitmentScreeningOpenOptions('appref_public_123')

  assert.equal(openAppIntelliOptions(options, { host }), 'opened')
  assert.deepEqual(calls[0], {
    context: {
      intentHint: 'recruitment_screening',
      entryPoint: 'public_application_success',
      pageSection: 'job_detail',
      journeyStage: 'screening',
      metadata: {
        ctaLabel: 'Continuar triagem',
        applicationReference: 'appref_public_123',
      },
    },
  })
  assert.doesNotMatch(JSON.stringify(calls[0]), /full_name|email|phone|city|neighborhood|candidate_id|application_id|job_id/)
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
  assert.equal(count(homePage, 'heroDemo'), 1)
  assert.equal(count(homePage, 'finalDemo'), 1)
  assert.equal(count(homePage, 'floatingChat'), 1)
  assert.equal(count(header, 'headerContact'), 0)
})

test('T13: menu stays navigation (anchor links, no chat buttons inside the nav)', () => {
  const header = read('src/components/Header.tsx')
  const nav = header.slice(header.indexOf('<nav'), header.indexOf('</nav>'))
  assert.match(nav, /<a\s/)
  assert.doesNotMatch(nav, /AppIntelliButton|onClick/)
  for (const href of ['/solucoes/recrutamento', '/#plataforma', '/vagas', '/#como-funciona', '/#sobre']) {
    assert.match(header, new RegExp(`href: '${href}'`))
  }
  assert.match(header, /href="\/login"/)
  assert.match(header, /Entrar/)
})

test('footer section links also work from non-home routes', () => {
  const footer = read('src/components/Footer.tsx')
  for (const href of ['/solucoes/recrutamento', '/#plataforma', '/vagas', '/#como-funciona', '/#sobre']) {
    assert.match(footer, new RegExp(`href: '${href}'`))
  }
  assert.match(footer, /contato@aktalent\.com\.br/)
})

test('T15: AppIntelli widget is installed by runtime config, not a hardcoded HTML script', () => {
  const html = read('index.html')
  assert.equal((html.match(/https:\/\/www\.appintelli\.com\.br\/widget\.js/g) ?? []).length, 0)
  assert.equal((html.match(/data-widget-key=/g) ?? []).length, 0)
  // Installed per route (commercial pages only), never globally at startup.
  assert.doesNotMatch(read('src/main.tsx'), /installAppIntelliWidget/)
  assert.match(read('src/components/AppIntelliRouteGate.tsx'), /installAppIntelliWidget\(\)/)
  assert.match(read('src/routes/AppRoutes.tsx'), /<AppIntelliRouteGate \/>/)
})

test('AppIntelli widget only on commercial pages', () => {
  for (const path of ['/', '/solucoes/recrutamento', '/solucoes/recrutamento/']) {
    assert.equal(isCommercialPath(path), true, path)
  }
  for (const path of ['/vagas', '/vagas/atendente', '/login', '/register', '/privacidade', '/admin', '/recrutador', '/recrutador/vagas/1', '/company', '/candidate', '/qualquer']) {
    assert.equal(isCommercialPath(path), false, path)
  }
  const gate = read('src/components/AppIntelliRouteGate.tsx')
  assert.match(gate, /window\.AppIntelli\?\.close\(\)/)
  const css = read('src/index.css')
  assert.match(css, /html\[data-appintelli='off'\] \[data-appintelli-mini-widget\]/)
  assert.match(css, /html\[data-appintelli='off'\] iframe\[title='AppIntelli Connect'\]/)
})

test('widget config defaults to production URL without embedding a live key', () => {
  const config = resolveAppIntelliWidgetConfig({} as ImportMetaEnv)

  assert.equal(config.url, DEFAULT_APPINTELLI_WIDGET_URL)
  assert.equal(config.key, '')
  assert.doesNotMatch(read('src/services/appIntelliWidgetLoader.ts'), /wk_live_/)
})

test('widget config accepts local URL and local public key from Vite env', () => {
  const config = resolveAppIntelliWidgetConfig({
    VITE_APPINTELLI_WIDGET_URL: 'http://localhost:3000/widget.js',
    VITE_APPINTELLI_WIDGET_KEY: 'local-test-key',
  } as ImportMetaEnv)

  assert.equal(config.url, 'http://localhost:3000/widget.js')
  assert.equal(config.key, 'local-test-key')
})

test('widget installer writes script src and public key without backend secrets', () => {
  const scripts: Array<{ id?: string; src?: string; async?: boolean; dataset: Record<string, string> }> = []
  const documentRef = {
    getElementById: () => null,
    createElement: () => {
      const script = { dataset: {} as Record<string, string> }
      scripts.push(script)
      return script
    },
    body: {
      appendChild: (script: unknown) => script,
    },
  } as unknown as Document

  const script = installAppIntelliWidget({
    VITE_APPINTELLI_WIDGET_URL: 'http://localhost:3000/widget.js',
    VITE_APPINTELLI_WIDGET_KEY: 'local-test-key',
  } as ImportMetaEnv, documentRef)

  assert.ok(script)
  assert.equal(script.id, 'appintelli-widget-script')
  assert.equal(script.src, 'http://localhost:3000/widget.js')
  assert.equal(script.async, true)
  assert.equal(script.dataset.widgetKey, 'local-test-key')
  assert.doesNotMatch(JSON.stringify(script), /APPINTELLI_INTEGRATION_SECRET|AKTALENT_INTEGRATION_SECRET/)
})

test('widget installer is idempotent and reports missing public key', () => {
  const error = console.error
  const errors: unknown[] = []
  console.error = (...args: unknown[]) => errors.push(args)
  try {
    const existing = { dataset: {} } as HTMLScriptElement
    const existingDocument = {
      getElementById: () => existing,
      createElement: () => {
        throw new Error('should not create another script')
      },
      body: { appendChild: () => undefined },
    } as unknown as Document
    assert.equal(installAppIntelliWidget({ VITE_APPINTELLI_WIDGET_KEY: 'local-key' } as ImportMetaEnv, existingDocument), existing)

    const missingKeyDocument = {
      getElementById: () => null,
      createElement: () => ({ dataset: {} }),
      body: { appendChild: () => undefined },
    } as unknown as Document
    assert.equal(installAppIntelliWidget({ VITE_APPINTELLI_WIDGET_KEY: '' } as ImportMetaEnv, missingKeyDocument), null)
  } finally {
    console.error = error
  }
  assert.equal(errors.length, 1)
  assert.match(String(errors[0]), /VITE_APPINTELLI_WIDGET_KEY/)
})

test('browser CTA path tries to install the widget before waiting for AppIntelli.open', async () => {
  const previousWindow = globalThis.window
  const host: { AppIntelli?: AppIntelliApi } = {}
  ;(globalThis as typeof globalThis & { window?: typeof host }).window = host
  let installs = 0
  try {
    assert.equal(
      openAppIntelli(appIntelliCtas.headerContact, {
        installWidget: () => {
          installs += 1
          return { dataset: {} } as HTMLScriptElement
        },
        pollMs: 5,
        waitMs: 20,
      }),
      'waiting',
    )
    await sleep(40)
  } finally {
    globalThis.window = previousWindow
  }
  assert.equal(installs, 1)
})
