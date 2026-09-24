import heroImage from '../assets/ak-talent-hero.png'
import { Container } from '../components/Container'

const iconPaths = {
  documents: ['M8 4h8l4 4v12H8z', 'M16 4v5h5', 'M4 8h3', 'M4 12h3', 'M4 16h3'],
  clock: ['M12 6v6l4 2', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  target: ['M12 3v3', 'M12 18v3', 'M3 12h3', 'M18 12h3', 'M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z', 'M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z'],
  briefcase: ['M10 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1', 'M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z', 'M4 12h16', 'M10 12v2h4v-2'],
  clipboard: ['M9 4h6', 'M10 3h4a2 2 0 0 1 2 2v1H8V5a2 2 0 0 1 2-2Z', 'M7 6h10a2 2 0 0 1 2 2v12H5V8a2 2 0 0 1 2-2Z', 'M8 12h8', 'M8 16h5'],
  search: ['M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z', 'M16 16l4 4', 'M8 11h6'],
  spark: ['M12 3l1.5 5L19 10l-5.5 2L12 17l-1.5-5L5 10l5.5-2Z', 'M19 3v4', 'M21 5h-4'],
  users: ['M16 19a4 4 0 0 0-8 0', 'M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M20 19a3 3 0 0 0-4-2.8', 'M16.5 5.5a3 3 0 0 1 0 5'],
  layers: ['M12 3 3 8l9 5 9-5-9-5Z', 'M3 12l9 5 9-5', 'M3 16l9 5 9-5'],
  shield: ['M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7Z', 'M9 12l2 2 4-5'],
  message: ['M5 5h14v10H8l-3 3Z', 'M8 9h8', 'M8 12h5'],
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
      strokeWidth="1.8"
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
    title: 'Entendimento da necessidade',
    description: 'A conversa inicial organiza contexto, prioridades e perfil desejado.',
  },
  {
    icon: 'clipboard',
    title: 'Estruturacao da vaga',
    description: 'A vaga ganha criterios claros para orientar a analise e a comunicacao.',
  },
  {
    icon: 'search',
    title: 'Analise de perfis',
    description: 'Informacoes dos candidatos sao lidas com apoio de IA e criterio humano.',
  },
  {
    icon: 'target',
    title: 'Match e priorizacao',
    description: 'Perfis aderentes ficam mais faceis de comparar e priorizar.',
  },
  {
    icon: 'users',
    title: 'Selecao assistida',
    description: 'A decisao segue acompanhada por pessoas, com dados mais organizados.',
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

const ctaClass =
  'inline-flex min-h-12 items-center justify-center rounded-lg px-6 text-sm font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'

export function HomePage() {
  return (
    <div className="bg-white">
      <section id="inicio" className="overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_72%)]">
        <Container className="grid items-center gap-12 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:py-24">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-500">Recrutamento inteligente com IA</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[1.02] text-ink-950 sm:text-6xl lg:text-7xl">
              Encontre as pessoas certas. Mais rapido.
            </h1>
            <p className="mt-6 max-w-2xl text-xl font-bold leading-8 text-ink-800">
              A AK Talent combina inteligencia artificial e analise humana para tornar o recrutamento mais agil,
              organizado e assertivo.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-ink-600 sm:text-lg">
              Atendimento inteligente para empresas que precisam contratar e profissionais que querem apresentar melhor
              sua trajetoria.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#empresas"
                className={`${ctaClass} bg-gold-500 text-ink-950 shadow-lg shadow-gold-500/20 hover:bg-gold-400 focus-visible:outline-gold-500`}
              >
                Quero contratar
              </a>
              <a
                href="#profissionais"
                className={`${ctaClass} border border-slate-300 bg-white text-ink-800 hover:border-gold-500 hover:text-ink-950 focus-visible:outline-gold-500`}
              >
                Busco oportunidades
              </a>
            </div>
          </div>

          <div className="relative min-w-0">
            <div className="absolute -right-3 -top-3 z-10 hidden max-w-56 rounded-lg border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/80 sm:block">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-500">Triagem assistida</p>
              <p className="mt-2 text-sm leading-6 text-ink-700">Dados, contexto e criterio reunidos para apoiar a selecao.</p>
            </div>
            <img
              src={heroImage}
              alt="Equipe analisando um processo de recrutamento em ambiente profissional"
              className="aspect-[4/3] w-full rounded-lg object-cover object-center shadow-2xl shadow-slate-300"
            />
            <div className="absolute -bottom-5 left-4 right-4 grid gap-2 rounded-lg border border-white/70 bg-ink-950/95 p-4 text-white shadow-xl sm:left-8 sm:right-auto sm:w-80">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-gold-500/15 text-gold-400">
                  <Icon name="spark" className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-black">Match inteligente</p>
                  <p className="text-xs leading-5 text-slate-300">Apoio para comparar necessidades e perfis.</p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section aria-labelledby="audience-title" className="bg-white py-16">
        <Container>
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-500">Como podemos ajudar?</p>
            <h2 id="audience-title" className="mt-3 text-3xl font-black text-ink-950 sm:text-4xl">
              Dois caminhos, uma experiencia mais clara.
            </h2>
          </div>
          <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-2">
            <article className="rounded-lg border border-slate-200 bg-slate-50 p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-gold-500/15 text-gold-500">
                <Icon name="briefcase" className="h-6 w-6" />
              </span>
              <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-ink-500">Empresas</p>
              <h3 className="mt-2 text-2xl font-black text-ink-950">Preciso contratar</h3>
              <p className="mt-4 leading-7 text-ink-600">
                Encontre profissionais mais aderentes a sua necessidade com um processo de recrutamento estruturado e
                apoiado por inteligencia artificial.
              </p>
              <a href="#empresas" className={`${ctaClass} mt-6 bg-ink-950 text-white hover:bg-ink-800 focus-visible:outline-gold-500`}>
                Quero contratar
              </a>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-ink-950 text-gold-400">
                <Icon name="users" className="h-6 w-6" />
              </span>
              <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-ink-500">Profissionais</p>
              <h3 className="mt-2 text-2xl font-black text-ink-950">Estou buscando oportunidades</h3>
              <p className="mt-4 leading-7 text-ink-600">
                Apresente seu perfil, experiencia e objetivos profissionais para que a AK Talent possa conhecer melhor
                sua trajetoria.
              </p>
              <a
                href="#profissionais"
                className={`${ctaClass} mt-6 border border-slate-300 bg-white text-ink-800 hover:border-gold-500 hover:text-ink-950 focus-visible:outline-gold-500`}
              >
                Apresentar meu perfil
              </a>
            </article>
          </div>
        </Container>
      </section>

      <section className="bg-slate-50 py-16">
        <Container>
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-500">Problema</p>
            <h2 className="mt-3 text-3xl font-black text-ink-950 sm:text-4xl">
              Contratar ainda e lento, manual e dificil de organizar.
            </h2>
          </div>
          <div className="mt-8 grid min-w-0 gap-4 md:grid-cols-3">
            {problems.map((problem) => (
              <article key={problem.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-gold-500/15 text-gold-500">
                  <Icon name={problem.icon} className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-black text-ink-950">{problem.title}</h3>
                <p className="mt-3 leading-7 text-ink-600">{problem.description}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section id="como-funciona" className="bg-white py-16">
        <Container>
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-500">Como funciona</p>
            <h2 className="mt-3 text-3xl font-black text-ink-950 sm:text-4xl">
              Um processo mais inteligente do inicio a decisao.
            </h2>
          </div>
          <div className="mt-10 grid min-w-0 gap-5 lg:grid-cols-5">
            {processSteps.map((step, index) => (
              <article key={step.title} className="relative rounded-lg border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-ink-400">{String(index + 1).padStart(2, '0')}</p>
                <span className="mt-5 grid h-11 w-11 place-items-center rounded-lg bg-white text-gold-500 shadow-sm">
                  <Icon name={step.icon} className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-base font-black leading-6 text-ink-950">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-ink-600">{step.description}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section id="empresas" className="bg-ink-950 py-16 text-white">
        <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-400">Para empresas</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Menos tempo filtrando. Mais clareza para decidir.</h2>
            <p className="mt-5 leading-7 text-slate-300">
              A AK Talent ajuda a transformar necessidades de contratacao em um processo mais estruturado, com informacoes
              organizadas e analise assistida para apoiar a priorizacao.
            </p>
            <a href="#conversa" className={`${ctaClass} mt-7 bg-gold-500 text-ink-950 hover:bg-gold-400 focus-visible:outline-white`}>
              Quero contratar
            </a>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {companyBenefits.map((benefit) => (
              <div key={benefit} className="flex gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-gold-400" />
                <p className="text-sm font-bold leading-6 text-slate-100">{benefit}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section id="profissionais" className="bg-white py-16">
        <Container className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-500">Para profissionais</p>
            <h2 className="mt-3 text-3xl font-black text-ink-950 sm:text-4xl">
              Seu perfil merece mais do que um curriculo perdido em uma caixa de entrada.
            </h2>
            <p className="mt-5 leading-7 text-ink-600">
              Voce pode apresentar sua trajetoria, interesses e objetivos profissionais para que a AK Talent conheca
              melhor seu momento. Isso nao garante vaga ou contratacao, mas torna o primeiro contato mais claro e completo.
            </p>
            <a
              href="#conversa"
              className={`${ctaClass} mt-7 border border-slate-300 bg-white text-ink-800 hover:border-gold-500 hover:text-ink-950 focus-visible:outline-gold-500`}
            >
              Apresentar meu perfil
            </a>
          </div>
          <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-6">
            <h3 className="text-lg font-black text-ink-950">Informacoes que ajudam a conversa</h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {professionalItems.map((item) => (
                <div key={item} className="rounded-lg bg-white px-4 py-3 text-sm font-bold text-ink-700 shadow-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section id="sobre" className="bg-slate-50 py-16">
        <Container className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-500">Humano + IA</p>
            <h2 className="mt-3 text-3xl font-black text-ink-950 sm:text-4xl">
              Inteligencia artificial sem tirar o humano do processo.
            </h2>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-7 shadow-sm">
            <p className="leading-7 text-ink-600">
              A IA ajuda a organizar informacoes, compreender necessidades, analisar dados e apoiar o processo. Decisoes
              que exigem avaliacao humana continuam sendo tratadas com responsabilidade pela equipe.
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-white py-16">
        <Container>
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-500">Diferenciais</p>
            <h2 className="mt-3 text-3xl font-black text-ink-950 sm:text-4xl">Uma experiencia pensada para reduzir atrito.</h2>
          </div>
          <div className="mt-8 grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {differentials.map((item) => (
              <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-slate-50 text-gold-500">
                  <Icon name={item.icon} className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-base font-black leading-6 text-ink-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-ink-600">{item.description}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section id="conversa" className="bg-white py-16">
        <Container className="rounded-lg bg-ink-950 px-6 py-12 text-white sm:px-10 lg:px-14">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-400">Comece pelo melhor proximo passo</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Vamos encontrar o proximo passo?</h2>
            <p className="mt-5 leading-7 text-slate-300">
              Seja para contratar ou buscar novas oportunidades, comece uma conversa com a AK Talent.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a href="#empresas" className={`${ctaClass} bg-gold-500 text-ink-950 hover:bg-gold-400 focus-visible:outline-white`}>
                Quero contratar
              </a>
              <a
                href="#profissionais"
                className={`${ctaClass} border border-white/20 text-white hover:border-gold-400 hover:text-gold-400 focus-visible:outline-white`}
              >
                Busco oportunidades
              </a>
            </div>
          </div>
        </Container>
      </section>
    </div>
  )
}
