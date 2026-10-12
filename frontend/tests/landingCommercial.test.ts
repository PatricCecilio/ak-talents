import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

function expectText(source: string, texts: string[]) {
  for (const text of texts) {
    assert.match(source, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
}

test('home tells the new model: the company talks to AK, AK selects, the company only chooses', () => {
  const source = read('src/pages/HomePage.tsx')

  expectText(source, [
    'Você conta o que precisa.',
    'A gente entrega os finalistas.',
    'A AK Talent anuncia a vaga, filtra, entrevista e te envia pelo WhatsApp os melhores candidatos, com parecer e currículo. Você só escolhe quem contratar.',
    'Recrutamos para todo tipo de negócio',
    'Você não precisa de sistema nem de RH. Só do WhatsApp.',
    'Precisa de uma pessoa ou de uma equipe inteira?',
    'Veja como a AK trabalha para você',
    'Vagas em destaque',
    'Sua próxima contratação começa com uma mensagem.',
  ])
  // Nothing suggesting the company signs up, logs in, posts jobs or follows a dashboard.
  const visible = `${source}\n${read('src/components/Footer.tsx')}\n${read('index.html')}\n${read('public/site.webmanifest')}`
  for (const old of [
    'Publique vagas',
    'Gestão de candidatos em um só painel',
    'Relatórios e indicadores em tempo real',
    'Plataforma completa',
    'Conheça a plataforma',
    'sem perder o controle',
    'Equipes de RH',
    'vagas simultâneas',
    'Plataforma e operação de recrutamento',
  ]) {
    assert.ok(!visible.includes(old), old)
  }
})

test('home uses the requested segment and platform structure', () => {
  const source = read('src/pages/HomePage.tsx')

  expectText(source, ['Varejo', 'Restaurantes', 'Logística', 'Indústria', 'Saúde', 'Serviços', 'Educação', 'Franquias'])
  expectText(source, [
    'Você conta pelo WhatsApp a vaga que precisa preencher',
    'A AK escreve o anúncio e divulga a vaga',
    'A AK filtra os candidatos e entrevista os melhores',
    'Você recebe os finalistas com parecer e currículo',
    'Você escolhe quem contratar, e a AK acompanha até o fim',
  ])
  // Mockups now read as "what you receive"; no invented company name or unverifiable numbers.
  expectText(source, ['Finalistas enviados a você', 'Aderência {match}', 'Vaga: Atendente de loja · Exemplo', 'Seus finalistas'])
  expectText(source, ["{ value: 'WhatsApp', label: 'um só contato' }", "{ value: 'Finalistas', label: 'com parecer' }"])
  assert.doesNotMatch(source, /50\+|1\.200\+|Padaria|Match \{match\}/)
})

test('company calls to action go to the commercial WhatsApp; the chat stays in the corner button', () => {
  const source = read('src/pages/HomePage.tsx')
  const ctas = read('src/services/appIntelliWidget.ts')
  const header = read('src/components/Header.tsx')

  // Top and final calls: same wrapper and classes as before, now a WhatsApp link with the ready message.
  assert.equal((source.match(/<HireWhatsappButton /g) ?? []).length, 2)
  assert.match(source, /<HireWhatsappButton className=\{`\$\{buttonPrimary\} w-full sm:w-auto`\} \/>/)
  assert.match(source, /<HireWhatsappButton className=\{buttonPrimary\} \/>/)
  assert.match(source, /const contact = hireContact\(\)/)
  assert.match(source, /'Falar no WhatsApp'/)
  assert.doesNotMatch(source, /AppIntelliButton|cta="heroDemo"|cta="finalDemo"|cta="floatingChat"/)
  assert.match(source, /heroOfficeImage/)
  assert.match(source, /videoThumbnailImage/)
  assert.match(source, /enterpriseImage/)
  assert.doesNotMatch(header, /AppIntelliButton|headerContact/)
  assert.doesNotMatch(source, /resolveWhatsappConfig|Prefiro deixar meus dados|<form/)
  assert.doesNotMatch(ctas, /candidateId|applicationId|jobId|workspaceId|email|phone|telefone|full_name/)

  // The "no jobs" notice keeps its own WhatsApp link for candidates.
  const notice = read('src/components/JobsUnavailableNotice.tsx')
  assert.match(source, /<JobsUnavailableNotice \/>/)
  assert.match(notice, /resolveWhatsappConfig/)
  assert.match(notice, /whatsapp\.url \?/)
  assert.doesNotMatch(notice, /AppIntelli|Falar com um especialista/)
})

test('featured jobs use the public API; sample jobs only in local development', () => {
  const source = read('src/pages/HomePage.tsx')

  assert.match(source, /getJobs\(\)/)
  assert.match(source, /fallbackJobs/)
  assert.match(source, /Exemplos de formatos de vagas/)
  assert.match(source, /Ver todas as vagas/)
  assert.match(source, /useFeaturedJobs\(allowDemoJobs: boolean = import\.meta\.env\.DEV\)/)
  assert.match(source, /resolveFeaturedJobsMode\(/)
  assert.match(source, /nextMode === 'demo' \? fallbackJobs : \[\]/)
  assert.doesNotMatch(source, /Failed to fetch/)
})

test('header and footer match the simplified navigation contract', () => {
  const header = read('src/components/Header.tsx')
  const footer = read('src/components/Footer.tsx')

  for (const label of ['Soluções', 'Para empresas', 'Vagas', 'Como funciona', 'Sobre']) {
    assert.match(header, new RegExp(label))
    assert.match(footer, new RegExp(label))
  }

  assert.match(header, /Entrar/)
  assert.match(footer, /contato@aktalent\.com\.br/)
  assert.doesNotMatch(header, /Conversar com a AK Talent|Falar com um especialista/)
})

test('campaign route and SEO metadata are wired without external tracking scripts', () => {
  const routes = read('src/routes/AppRoutes.tsx')
  const html = read('index.html')

  assert.match(routes, /\/solucoes\/recrutamento/)
  assert.match(routes, /RecruitmentSolutionPage/)
  assert.match(html, /<title>AK Talent \| Recrutamento para pequenas e médias empresas<\/title>/)
  assert.match(html, /Você conta a vaga pelo WhatsApp; a AK Talent anuncia, filtra, entrevista e envia os finalistas com parecer\. Você só escolhe\./)
  assert.match(html, /og:title/)
  assert.doesNotMatch(`${routes}\n${html}`, /googletagmanager|gtag|Meta Pixel|fbq|tiktok|analytics/i)
})
