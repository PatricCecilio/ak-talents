import heroImage from '../assets/ak-talent-hero.png'
import { AppIntelliButton } from '../components/AppIntelliButton'
import { Container } from '../components/Container'

const iconPaths = {
  documents: ['M7 4h8l4 4v12H7z', 'M15 4v5h5', 'M4 8h3', 'M4 13h3', 'M10 13h6', 'M10 17h6'],
  clock: ['M12 7v5l3 2', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  target: ['M12 3v3', 'M12 18v3', 'M3 12h3', 'M18 12h3', 'M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z', 'M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z'],
  briefcase: ['M10 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1', 'M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z', 'M4 12h16', 'M10 12v2h4v-2'],
  clipboard: ['M9 4h6', 'M10 3h4a2 2 0 0 1 2 2v1H8V5a2 2 0 0 1 2-2Z', 'M7 6h10a2 2 0 0 1 2 2v12H5V8a2 2 0 0 1 2-2Z', 'M8 12h8', 'M8 16h5'],
  search: ['M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z', 'M16 16l4 4', 'M8 11h6'],
  spark: ['M12 3l1.5 5L19 10l-5.5 2L12 17l-1.5-5L5 10l5.5-2Z', 'M19 3v4', 'M21 5h-4'],
  users: ['M16 19a4 4 0 0 0-8 0', 'M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M20 19a3 3 0 0 0-4-2.8', 'M16.5 5.5a3 3 0 0 1 0 5'],
  layers: ['M12 3 3 8l9 5 9-5-9-5Z', 'M3 12l9 5 9-5', 'M3 16l9 5 9-5'],
  shield: ['M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7Z', 'M9 12l2 2 4-5'],
  message: ['M5 5h14v10H8l-3 3Z', 'M8 9h8', 'M8 12h5'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  personCheck: ['M15 20a5 5 0 0 0-10 0', 'M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M15 11l2 2 4-5'],
} as const

type IconName = keyof typeof iconPaths

function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
    >
      {iconPaths[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  )
}

const problems = [
  {
    icon: 'documents',
    title: 'Muitos curriculos para analisar',
    description: 'Triagens manuais dispersam informacoes importantes e tornam a comparacao entre perfis mais lenta.',
  },
  {
    icon: 'clock',
    title: 'Pouco tempo para entrevistar',
    description: 'Equipes precisam ganhar clareza antes das conversas para usar melhor cada etapa do processo.',
  },
  {
    icon: 'target',
    title: 'Dificuldade em encontrar aderencia',
    description: 'Requisitos, experiencia, contexto e objetivos precisam ser avaliados com mais organizacao.',
  },
] satisfies Array<{ icon: IconName; title: string; description: string }>

const processSteps = [
  {
    icon: 'message',
    title: 'Entendimento',
    description: 'Contexto, prioridades e perfil desejado ficam claros desde o primeiro contato.',
  },
  {
    icon: 'clipboard',
    title: 'Estruturacao',
    description: 'A vaga ganha criterios objetivos para orientar a analise.',
  },
  {
    icon: 'search',
    title: 'Analise',
    description: 'Perfis sao lidos com apoio de IA e criterio humano.',
  },
  {
    icon: 'target',
    title: 'Match',
    description: 'Aderencias ficam mais faceis de comparar e priorizar.',
  },
  {
    icon: 'users',
    title: 'Selecao',
    description: 'A decisao segue acompanhada por pessoas, com dados organizados.',
  },
] satisfies Array<{ icon: IconName; title: string; description: string }>

const companyBenefits = [
  'Estruturacao da necessidade da vaga',
  'Organizacao dos candidatos',
  'Analise assistida de curriculos',
  'Identificacao de aderencia',
  'Apoio a priorizacao',
  'Historico centralizado do processo',
]

const professionalItems = [
  'Area de interesse',
  'Experiencia',
  'Localizacao',
  'Disponibilidade',
  'Competencias',
  'Objetivos profissionais',
]

const differentials = [
  {
    icon: 'message',
    title: 'Atendimento desde o primeiro contato',
    description: 'Empresas e profissionais encontram um caminho claro para iniciar a conversa.',
  },
  {
    icon: 'layers',
    title: 'Informacoes organizadas',
    description: 'Dados relevantes ficam estruturados para reduzir ruidos no processo.',
  },
  {
    icon: 'spark',
    title: 'Analise assistida por IA',
    description: 'A tecnologia apoia leitura, agrupamento e priorizacao sem substituir criterio humano.',
  },
  {
    icon: 'shield',
    title: 'Processo acompanhado por pessoas',
    description: 'As etapas sensiveis continuam tratadas com responsabilidade e contexto.',
  },
] satisfies Array<{ icon: IconName; title: string; description: string }>

const buttonBase =
  'inline-flex min-h-12 items-center justify-center rounded-lg px-6 text-sm font-black transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
const buttonPrimary = `${buttonBase} bg-gold-500 text-ink-950 shadow-lg shadow-gold-500/20 hover:-translate-y-0.5 hover:bg-gold-400 focus-visible:outline-gold-500`
const buttonSecondary = `${buttonBase} border border-ink-800/25 bg-white text-ink-950 hover:-translate-y-0.5 hover:border-gold-500 hover:text-ink-950 focus-visible:outline-gold-500`

export function HomePage() {
  return (
    <div className="bg-white">
      <section id="inicio" className="overflow-hidden bg-[linear-gradient(180deg,#f6f8fb_0%,#ffffff_78%)]">
        <Container className="grid items-center gap-14 py-14 lg:grid-cols-[0.92fr_1.08fr] lg:py-20 xl:gap-18">
          <div className="min-w-0">
            <p className="max-w-sm text-xs font-black uppercase tracking-[0.22em] text-gold-500 sm:max-w-none sm:text-sm sm:tracking-[0.26em]">
              Recrutamento inteligente com IA
            </p>
            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.04] text-ink-950 sm:text-6xl lg:text-[4.9rem]">
              Encontre as pessoas certas. Mais rapido.
            </h1>
            <p className="mt-7 max-w-2xl text-xl font-bold leading-9 text-ink-800">
              A AK Talent combina inteligencia artificial e analise humana para tornar o recrutamento mais agil,
              organizado e assertivo.
            </p>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-ink-600">
              Atendimento inteligente para empresas que precisam contratar e profissionais que querem apresentar melhor
              sua trajetoria.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <AppIntelliButton cta="heroHiring" className={buttonPrimary} />
              <AppIntelliButton cta="heroJobSeeker" className={buttonSecondary} />
            </div>
          </div>

          <div className="relative min-w-0 pb-8">
            <div className="absolute -right-2 top-6 z-10 hidden w-64 rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-300/70 sm:block">
              <div className="flex items-start gap-4">
                <Icon name="clipboard" className="mt-1 h-8 w-8 text-gold-500" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-gold-500">Triagem assistida</p>
                  <p className="mt-2 text-sm leading-6 text-ink-700">Dados e contexto reunidos para apoiar a selecao.</p>
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg bg-slate-100 shadow-2xl shadow-slate-300">
              <img
                src={heroImage}
                alt="Equipe analisando um processo de recrutamento em ambiente profissional"
                className="aspect-[4/3] w-full object-cover object-center"
              />
            </div>
            <div className="absolute bottom-0 left-5 right-5 rounded-lg border border-white/10 bg-ink-950/95 p-5 text-white shadow-2xl shadow-slate-400/70 sm:left-10 sm:right-auto sm:w-[25rem]">
              <div className="flex items-start gap-4">
                <Icon name="spark" className="h-9 w-9 shrink-0 text-gold-400" />
                <div>
                  <p className="text-base font-black">Match inteligente</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">Apoio para comparar necessidades, contexto e perfis.</p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section aria-labelledby="audience-title" className="bg-white py-18 sm:py-20">
        <Container>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-gold-500 sm:text-sm sm:tracking-[0.26em]">Como podemos ajudar?</p>
              <h2 id="audience-title" className="mt-4 text-3xl font-black leading-tight text-ink-950 sm:text-5xl">
                Dois caminhos, uma experiencia mais clara.
              </h2>
            </div>
            <p className="max-w-xl text-lg leading-8 text-ink-600">
              A entrada certa muda a conversa: empresas estruturam contratacoes; profissionais apresentam trajetoria e objetivos.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <a
              href="#empresas"
              className="group relative overflow-hidden rounded-lg bg-ink-950 p-8 text-white shadow-xl shadow-slate-200 transition duration-200 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            >
              <Icon name="briefcase" className="h-16 w-16 text-gold-400" />
              <p className="mt-10 text-sm font-black uppercase tracking-[0.24em] text-gold-400">Empresas</p>
              <div className="mt-3 flex items-end justify-between gap-5">
                <div>
                  <h3 className="text-3xl font-black text-white">Preciso contratar</h3>
                  <p className="mt-4 max-w-xl text-base leading-8 text-slate-300">
                    Encontre profissionais mais aderentes a sua necessidade com um processo estruturado e apoiado por IA.
                  </p>
                </div>
                <Icon name="arrow" className="hidden h-9 w-9 shrink-0 text-gold-400 transition group-hover:translate-x-1 sm:block" />
              </div>
            </a>

            <a
              href="#profissionais"
              className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-8 text-ink-950 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-gold-500/60 hover:shadow-xl hover:shadow-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            >
              <Icon name="personCheck" className="h-16 w-16 text-gold-500" />
              <p className="mt-10 text-sm font-black uppercase tracking-[0.24em] text-ink-500">Profissionais</p>
              <div className="mt-3 flex items-end justify-between gap-5">
                <div>
                  <h3 className="text-3xl font-black">Estou buscando oportunidades</h3>
                  <p className="mt-4 max-w-xl text-base leading-8 text-ink-600">
                    Apresente seu perfil, experiencia e objetivos para que a AK Talent conheca melhor sua trajetoria.
                  </p>
                </div>
                <Icon name="arrow" className="hidden h-9 w-9 shrink-0 text-gold-500 transition group-hover:translate-x-1 sm:block" />
              </div>
            </a>
          </div>
        </Container>
      </section>

      <section className="bg-slate-50 py-18 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.4fr] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-gold-500 sm:text-sm sm:tracking-[0.26em]">Problema</p>
              <h2 className="mt-4 text-3xl font-black leading-tight text-ink-950 sm:text-5xl">
                Contratar ainda e lento, manual e dificil de organizar.
              </h2>
            </div>
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {problems.map((problem) => (
                <article key={problem.title} className="grid gap-5 py-7 sm:grid-cols-[4rem_1fr]">
                  <Icon name={problem.icon} className="h-12 w-12 text-gold-500 sm:h-14 sm:w-14" />
                  <div>
                    <h3 className="text-2xl font-black text-ink-950">{problem.title}</h3>
                    <p className="mt-3 text-base leading-8 text-ink-600">{problem.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section id="como-funciona" className="bg-white py-18 sm:py-20">
        <Container>
          <div className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-gold-500 sm:text-sm sm:tracking-[0.26em]">Como funciona</p>
            <h2 className="mt-4 text-3xl font-black leading-tight text-ink-950 sm:text-5xl">
              Um processo mais inteligente do inicio a decisao.
            </h2>
          </div>

          <div className="relative mt-12">
            <div className="absolute left-6 top-0 hidden h-full w-px bg-slate-200 md:block lg:left-0 lg:top-9 lg:h-px lg:w-full" />
            <div className="grid gap-8 md:pl-16 lg:grid-cols-5 lg:gap-6 lg:pl-0">
              {processSteps.map((step, index) => (
                <article key={step.title} className="relative">
                  <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-gold-500/30 bg-white text-gold-500 shadow-lg shadow-slate-200">
                    <Icon name={step.icon} className="h-7 w-7" />
                  </div>
                  <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-ink-400">
                    etapa {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-2 text-xl font-black text-ink-950">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-ink-600">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section id="empresas" className="bg-ink-950 py-18 text-white sm:py-24">
        <Container className="grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-gold-400 sm:text-sm sm:tracking-[0.26em]">Para empresas</p>
            <h2 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">Menos tempo filtrando. Mais clareza para decidir.</h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              A AK Talent ajuda a transformar necessidades de contratacao em um processo mais estruturado, com informacoes
              organizadas e analise assistida para apoiar a priorizacao.
            </p>
            <AppIntelliButton cta="companySection" className={`${buttonPrimary} mt-8`} />
          </div>

          <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {companyBenefits.map((benefit) => (
              <div key={benefit} className="flex items-start gap-4 border-t border-white/12 pt-5">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-gold-400" />
                <p className="text-base font-semibold leading-7 text-slate-100">{benefit}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section id="profissionais" className="bg-white py-18 sm:py-20">
        <Container className="grid gap-12 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-gold-500 sm:text-sm sm:tracking-[0.26em]">Para profissionais</p>
            <h2 className="mt-4 text-3xl font-black leading-tight text-ink-950 sm:text-5xl">
              Seu perfil merece mais do que um curriculo perdido em uma caixa de entrada.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-600">
              Voce pode apresentar sua trajetoria, interesses e objetivos profissionais para que a AK Talent conheca
              melhor seu momento. Isso nao garante vaga ou contratacao, mas torna o primeiro contato mais claro e completo.
            </p>
            <AppIntelliButton cta="professionalSection" className={`${buttonSecondary} mt-8`} />
          </div>

          <div className="rounded-lg border-l-4 border-gold-500 bg-slate-50 px-7 py-8">
            <div className="flex items-center gap-4">
              <Icon name="personCheck" className="h-12 w-12 text-gold-500" />
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-ink-500">Perfil profissional</p>
                <h3 className="mt-1 text-2xl font-black text-ink-950">O que a conversa pode compreender</h3>
              </div>
            </div>
            <div className="mt-8 divide-y divide-slate-200">
              {professionalItems.map((item) => (
                <div key={item} className="flex items-center justify-between gap-6 py-3">
                  <span className="text-base font-semibold text-ink-700">{item}</span>
                  <span className="h-px min-w-10 flex-1 bg-slate-200" />
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section id="sobre" className="bg-slate-50 py-18 sm:py-24">
        <Container className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-gold-500 sm:text-sm sm:tracking-[0.26em]">Humano + IA</p>
            <h2 className="mt-4 text-3xl font-black leading-tight text-ink-950 sm:text-5xl">
              Inteligencia artificial sem tirar o humano do processo.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-600">
              A IA ajuda a organizar informacoes, compreender necessidades, analisar dados e apoiar o processo. Decisoes
              que exigem avaliacao humana continuam sendo tratadas com responsabilidade pela equipe.
            </p>
          </div>

          <div className="relative rounded-lg bg-white p-8 shadow-xl shadow-slate-200">
            <div className="grid gap-5">
              {[
                { icon: 'spark', title: 'IA organiza', text: 'Informacoes dispersas viram contexto analisavel.' },
                { icon: 'layers', title: 'Processo estrutura', text: 'Dados, etapas e criterios ficam mais claros.' },
                { icon: 'users', title: 'Pessoas decidem', text: 'Avaliacoes sensiveis continuam com criterio humano.' },
              ].map((item, index) => (
                <div key={item.title} className="relative grid gap-4 sm:grid-cols-[4rem_1fr]">
                  <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-ink-950 text-gold-400">
                    <Icon name={item.icon as IconName} className="h-7 w-7" />
                  </div>
                  <div className="pb-1">
                    <h3 className="text-xl font-black text-ink-950">{item.title}</h3>
                    <p className="mt-2 leading-7 text-ink-600">{item.text}</p>
                  </div>
                  {index < 2 ? <div className="ml-7 hidden h-7 w-px bg-slate-200 sm:block" /> : null}
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-white py-18 sm:py-20">
        <Container>
          <div className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-gold-500 sm:text-sm sm:tracking-[0.26em]">Diferenciais</p>
            <h2 className="mt-4 text-3xl font-black leading-tight text-ink-950 sm:text-5xl">
              Uma experiencia pensada para reduzir atrito.
            </h2>
          </div>
          <div className="mt-10 grid gap-0 border-y border-slate-200 md:grid-cols-2 lg:grid-cols-4">
            {differentials.map((item) => (
              <article key={item.title} className="border-b border-slate-200 py-8 md:border-r md:px-7 lg:border-b-0 first:pl-0 last:border-r-0">
                <Icon name={item.icon} className="h-12 w-12 text-gold-500" />
                <h3 className="mt-6 text-xl font-black leading-7 text-ink-950">{item.title}</h3>
                <p className="mt-4 text-base leading-7 text-ink-600">{item.description}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section id="conversa" className="bg-white py-18 sm:py-20">
        <Container>
          <div className="rounded-lg bg-ink-950 px-7 py-16 text-white sm:px-12 lg:px-16 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-3xl">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-gold-400 sm:text-sm sm:tracking-[0.26em]">Comece pelo melhor proximo passo</p>
                <h2 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">Vamos encontrar o proximo passo?</h2>
                <p className="mt-6 text-lg leading-8 text-slate-300">
                  Seja para contratar ou buscar novas oportunidades, comece uma conversa com a AK Talent.
                </p>
              </div>
              <div className="flex">
                <AppIntelliButton cta="finalContact" className={buttonPrimary} />
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  )
}
