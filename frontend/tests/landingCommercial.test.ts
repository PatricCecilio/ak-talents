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
    'Publique vagas, organize candidatos e acompanhe todo o processo de contratação em um só lugar',
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
    'Gestão de candidatos',
    'Triagem',
    'Entrevistas',
    'Relatórios',
    'Acompanhamento',
  ])
  expectText(source, ['50+', '1.200+', 'vagas simultâneas', 'candidatos por mês'])
})

test('commercial conversion is AppIntelli-first and avoids WhatsApp/form CTAs on the home', () => {
  const source = read('src/pages/HomePage.tsx')
  const ctas = read('src/services/appIntelliWidget.ts')
  const header = read('src/components/Header.tsx')

  assert.match(source, /cta="heroDemo"/)
  assert.match(source, /cta="finalDemo"/)
  assert.match(source, /cta="floatingChat"/)
  assert.match(source, /heroOfficeImage/)
  assert.match(source, /videoThumbnailImage/)
  assert.match(source, /enterpriseImage/)
  assert.doesNotMatch(header, /AppIntelliButton|headerContact/)
  assert.doesNotMatch(source, /WhatsApp|resolveWhatsappConfig|Prefiro deixar meus dados|<form/)
  assert.doesNotMatch(ctas, /candidateId|applicationId|jobId|workspaceId|email|phone|telefone|full_name/)
})

test('featured jobs use the public jobs API with a friendly fallback', () => {
  const source = read('src/pages/HomePage.tsx')

  assert.match(source, /getJobs\(\)/)
  assert.match(source, /fallbackJobs/)
  assert.match(source, /Exemplos de formatos de vagas/)
  assert.match(source, /Ver todas as vagas/)
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
  assert.doesNotMatch(`${routes}\n${html}`, /googletagmanager|gtag|Meta Pixel|fbq|tiktok|analytics/i)
})
