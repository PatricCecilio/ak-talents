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

test('home landing follows the new enterprise visual narrative', () => {
  const source = read('src/pages/HomePage.tsx')

  expectText(source, [
    'Encontre os melhores talentos',
    'sem perder o controle.',
    'Nós publicamos suas vagas, organizamos os candidatos e acompanhamos todo o processo de contratação para você',
    'Soluções para diferentes segmentos',
    'Tudo o que sua empresa precisa para recrutar melhor.',
    'Pronto para grandes operações de contratação?',
    'Veja a AK Talent em ação',
    'Vagas em destaque',
    'Sua próxima contratação pode começar aqui.',
  ])
})

test('home uses the requested segment and platform structure', () => {
  const source = read('src/pages/HomePage.tsx')

  expectText(source, ['Varejo', 'Restaurantes', 'Logística', 'Indústria', 'Saúde', 'Serviços', 'Educação', 'Franquias'])
  expectText(source, [
    'Divulgação de vagas em múltiplos canais',
    'Nossa equipe organiza os candidatos para você',
    'Triagem',
    'Entrevistas',
    'Relatórios sobre cada etapa, enviados a você',
    'Acompanhamento',
  ])
  // The company does not use the system itself: AK publishes, organizes and follows up.
  const visible = `${source}\n${read('index.html')}\n${read('src/layouts/AuthLayout.tsx')}`
  for (const old of ['Publique vagas', 'Gestão de candidatos em um só painel', 'em tempo real', 'Plataforma completa', 'Controle vagas', 'Distribua responsabilidades', 'nossa plataforma ajuda', 'candidatos e empresas']) {
    assert.ok(!visible.includes(old), old)
  }
  expectText(source, ['50+', '1.200+', 'vagas simultâneas', 'candidatos por mês'])
})

test('commercial conversion is AppIntelli-first; WhatsApp only as fallback when there are no jobs', () => {
  const source = read('src/pages/HomePage.tsx')
  const ctas = read('src/services/appIntelliWidget.ts')
  const header = read('src/components/Header.tsx')

  assert.match(source, /cta="heroDemo"/)
  assert.match(source, /cta="finalDemo"/)
  assert.doesNotMatch(source, /cta="floatingChat"/)
  assert.match(source, /heroOfficeImage/)
  assert.match(source, /videoThumbnailImage/)
  assert.match(source, /enterpriseImage/)
  assert.doesNotMatch(header, /AppIntelliButton|headerContact/)
  assert.doesNotMatch(source, /WhatsApp|resolveWhatsappConfig|Prefiro deixar meus dados|<form/)
  assert.doesNotMatch(ctas, /candidateId|applicationId|jobId|workspaceId|email|phone|telefone|full_name/)

  // The only WhatsApp entry point on the home is the "no jobs" notice, never a commercial CTA.
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
  assert.match(html, /AK Talent \| Recrutamento e triagem de candidatos/)
  assert.match(html, /og:title/)
  // No tracking script in the HTML: Google Analytics only loads from src/services/analytics.ts after consent.
  assert.doesNotMatch(html, /googletagmanager|gtag|Meta Pixel|fbq|tiktok|analytics/i)
  assert.doesNotMatch(routes, /googletagmanager|gtag\(|Meta Pixel|fbq|tiktok/i)
})
