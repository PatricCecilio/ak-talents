import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import enterpriseImage from '../assets/ak-talent-enterprise-team.webp'
import heroOfficeImage from '../assets/ak-talent-hero-office.webp'
import videoThumbnailImage from '../assets/ak-talent-video-thumbnail.webp'
import { AppIntelliButton } from '../components/AppIntelliButton'
import { Container } from '../components/Container'
import { JobsUnavailableNotice } from '../components/JobsUnavailableNotice'
import { LoadingHint } from '../components/JobsLoading'
import { useScrolledPast } from '../hooks/useScrolledPast'
import { resolveFeaturedJobsMode, type FeaturedJobsMode } from '../services/featuredJobs'
import { formatWorkMode } from '../services/jobFormat'
import { getJobs } from '../services/jobService'
import type { Job } from '../types/user'

const iconPaths = {
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  briefcase: ['M10 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1', 'M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z', 'M4 12h16'],
  building: ['M4 20V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15', 'M16 9h2a2 2 0 0 1 2 2v9', 'M8 7h4', 'M8 11h4', 'M8 15h4'],
  chart: ['M4 19V5', 'M4 19h16', 'M8 15v-4', 'M12 15V8', 'M16 15v-6'],
  chat: ['M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z'],
  check: ['M20 6 9 17l-5-5'],
  clipboard: ['M9 4h6', 'M10 3h4a2 2 0 0 1 2 2v1H8V5a2 2 0 0 1 2-2Z', 'M7 6h10a2 2 0 0 1 2 2v12H5V8a2 2 0 0 1 2-2Z', 'M8 12h8', 'M8 16h5'],
  factory: ['M3 20V9l5 3V9l5 3V8h8v12', 'M7 16h2', 'M12 16h2', 'M17 16h2'],
  heart: ['M20.8 8.6a5.5 5.5 0 0 0-9.8-3.4 5.5 5.5 0 0 0-9.8 3.4c0 5.1 9.8 10.4 9.8 10.4s9.8-5.3 9.8-10.4Z'],
  layers: ['M12 3 3 8l9 5 9-5-9-5Z', 'M3 12l9 5 9-5', 'M3 16l9 5 9-5'],
  pin: ['M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21Z', 'M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  play: ['M8 5v14l11-7Z'],
  playCircle: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M10 8.5v7l5.5-3.5Z'],
  search: ['M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z', 'M16 16l4 4'],
  store: ['M4 10h16', 'M5 10l1-5h12l1 5', 'M6 10v10h12V10', 'M9 20v-6h6v6'],
  truck: ['M3 7h11v9H3Z', 'M14 10h4l3 3v3h-7Z', 'M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'],
  users: ['M16 19a4 4 0 0 0-8 0', 'M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M20 19a3 3 0 0 0-4-2.8'],
  utensils: ['M6 3v8', 'M10 3v8', 'M6 7h4', 'M8 11v10', 'M17 3v18', 'M14 3h6'],
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

const buttonBase =
  'inline-flex min-h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-lg px-6 text-center text-[15px] font-semibold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
const buttonPrimary = `${buttonBase} bg-gold-700 text-white shadow-lg shadow-gold-700/25 hover:bg-gold-800 focus-visible:outline-gold-600`
const buttonSecondary = `${buttonBase} border border-ink-950/15 bg-white text-ink-950 shadow-sm hover:border-ink-800/40 focus-visible:outline-gold-600`
const buttonNavy = `${buttonBase} bg-ink-950 text-white shadow-lg shadow-ink-950/20 hover:bg-ink-800 focus-visible:outline-gold-600`

const eyebrowPill =
  'inline-flex rounded-full border border-gold-600/40 bg-gold-50 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-800'
const sectionTitle = 'font-display text-3xl font-bold leading-[1.12] tracking-[-0.02em] text-ink-950 sm:text-4xl lg:text-[2.6rem]'

const segments = [
  { icon: 'store', label: 'Varejo' },
  { icon: 'utensils', label: 'Restaurantes' },
  { icon: 'truck', label: 'Logística' },
  { icon: 'factory', label: 'Indústria' },
  { icon: 'heart', label: 'Saúde' },
  { icon: 'users', label: 'Serviços' },
  { icon: 'clipboard', label: 'Educação' },
  { icon: 'building', label: 'Franquias' },
  { icon: 'layers', label: 'Entre outros' },
] satisfies Array<{ icon: IconName; label: string }>

const platformFeatures = [
  'Divulgação de vagas em múltiplos canais',
  'Gestão de candidatos em um só painel',
  'Triagem e entrevistas organizadas por etapa',
  'Relatórios e indicadores em tempo real',
  'Acompanhamento até a contratação',
]

const enterpriseMetrics = [
  { value: '50+', label: 'vagas simultâneas' },
  { value: '1.200+', label: 'candidatos por mês' },
  { value: 'Multi', label: 'unidades e regiões' },
  { value: 'RH', label: 'equipes conectadas' },
]

const enterpriseHighlights = [
  { icon: 'users', title: 'Alto volume', text: 'Centenas de candidatos em uma única operação.' },
  { icon: 'building', title: 'Múltiplas unidades', text: 'Controle vagas e candidatos por região, loja ou unidade.' },
  { icon: 'briefcase', title: 'Equipes de RH', text: 'Distribua responsabilidades e acompanhe cada etapa.' },
] satisfies Array<{ icon: IconName; title: string; text: string }>

const videoPoints = [
  { icon: 'clipboard', text: 'Publicação de vagas em múltiplos canais' },
  { icon: 'users', text: 'Triagem e organização de candidatos' },
  { icon: 'chart', text: 'Acompanhamento até a contratação' },
] satisfies Array<{ icon: IconName; text: string }>

const fallbackJobs = [
  { title: 'Atendente de Restaurante', company: 'AK Talent', location: 'Curitiba, PR', workMode: 'Presencial', status: 'Contratação imediata', area: 'Restaurantes' },
  { title: 'Auxiliar de Operações', company: 'AK Talent', location: 'São Paulo, SP', workMode: 'Presencial', status: 'Em andamento', area: 'Logística' },
  { title: 'Operador de Loja', company: 'AK Talent', location: 'Belo Horizonte, MG', workMode: 'Presencial', status: 'Nova oportunidade', area: 'Varejo' },
  { title: 'Analista de RH', company: 'AK Talent', location: 'Curitiba, PR', workMode: 'Híbrido', status: 'Recebendo candidatos', area: 'Administrativo' },
]

const areaIcons: Record<string, IconName> = {
  Restaurantes: 'utensils',
  'Logística': 'truck',
  Varejo: 'store',
}

const avatarTones = ['bg-ink-800 text-white', 'bg-gold-100 text-gold-800', 'bg-slate-200 text-ink-800', 'bg-brand-500 text-white']

interface FeaturedJob {
  title: string
  company: string
  location: string
  workMode: string
  status: string
  area: string
  slug?: string
}

interface MarketingLandingProps {
  campaign?: boolean
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
}

function Avatar({ name, index }: { name: string; index: number }) {
  return (
    <span
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-bold ${avatarTones[index % avatarTones.length]}`}
    >
      {initials(name)}
    </span>
  )
}

// Demo product chrome shared by the hero dashboard and the platform mockup. Data is illustrative only.
function AppTopBar() {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-3 py-2 sm:px-4">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-ink-950 text-[9px] font-bold text-gold-300">AK</span>
      <span className="text-xs font-bold text-ink-950">AK Talent</span>
      <span className="ml-2 hidden h-7 min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-[10px] text-ink-400 sm:flex">
        <Icon name="search" className="h-3 w-3 shrink-0" />
        <span className="truncate">Buscar candidatos, vagas ou palavras-chave...</span>
      </span>
      <span className="ml-auto flex items-center gap-2">
        <span className="hidden text-right leading-tight sm:block">
          <span className="block text-[10px] font-semibold text-ink-950">Mariana Silva</span>
          <span className="block text-[9px] text-ink-400">RH - Matriz</span>
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gold-100 text-[10px] font-bold text-gold-800">MS</span>
      </span>
    </div>
  )
}

function AppSidebar({ active, className = '' }: { active: string; className?: string }) {
  const activeTone = active === 'Visão geral' ? 'bg-ink-950 text-white' : 'bg-gold-50 text-gold-800'

  return (
    <aside className={`border-r border-slate-100 bg-slate-50/70 p-2 ${className}`}>
      {['Visão geral', 'Vagas', 'Candidatos', 'Triagem', 'Entrevistas', 'Contratações', 'Relatórios'].map((item) => (
        <div
          key={item}
          className={`mb-0.5 rounded-md px-2.5 py-1.5 text-[10px] font-medium ${item === active ? activeTone : 'text-ink-600'}`}
        >
          {item}
        </div>
      ))}
    </aside>
  )
}

function HeroDashboard() {
  const stats = [
    ['1.284', 'Candidatos recebidos', '+12%'],
    ['327', 'Em triagem', '+18%'],
    ['86', 'Entrevistas', '+24%'],
    ['42', 'Contratações', '+31%'],
  ]
  const featured = [
    ['Carla Mendes', 'Analista de Marketing', '92%'],
    ['Rafael Souza', 'Desenvolvedor Full Stack', '88%'],
    ['Juliana Alves', 'Analista Financeiro', '85%'],
    ['Diego Lima', 'Designer UI/UX', '83%'],
  ]
  const pipeline = [
    ['Candidatos', '1.284', 100],
    ['Triagem', '327', 62],
    ['Entrevistas', '86', 38],
    ['Propostas', '54', 22],
    ['Contratações', '42', 14],
  ] as const

  return (
    <div
      role="img"
      aria-label="Painel demonstrativo da plataforma AK Talent com candidatos, triagem, entrevistas e contratações"
      className="overflow-hidden rounded-xl bg-white shadow-[0_32px_80px_-24px_rgba(6,20,36,0.5)] ring-1 ring-ink-950/10"
    >
      <AppTopBar />
      <div className="grid xl:grid-cols-[7rem_1fr]">
        <AppSidebar active="Visão geral" className="hidden xl:block" />
        <div className="p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.map(([value, label, delta]) => (
              <div key={label} className="rounded-lg border border-slate-100 p-2.5">
                <p className="font-display text-lg font-bold leading-none text-ink-950">{value}</p>
                <p className="mt-1.5 text-[10px] leading-tight text-ink-600">{label}</p>
                <p className="mt-1 whitespace-nowrap text-[9px] font-semibold text-emerald-600">{delta} no mês</p>
              </div>
            ))}
          </div>

          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[1.1fr_1fr]">
            <div className="rounded-lg border border-slate-100">
              <div className="flex items-center justify-between px-2.5 py-2">
                <p className="text-[11px] font-bold text-ink-950">Candidatos em destaque</p>
                <span className="text-[9px] text-ink-400">Ver todos</span>
              </div>
              {featured.map(([name, role, match], index) => (
                <div key={name} className="flex items-center gap-2 border-t border-slate-100 px-2.5 py-1.5">
                  <Avatar name={name} index={index} />
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-[10px] font-semibold text-ink-950">{name}</p>
                    <p className="truncate text-[9px] text-ink-400">{role}</p>
                  </div>
                  <span className="ml-auto shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                    Match {match}
                  </span>
                </div>
              ))}
            </div>

            <div className="hidden rounded-lg border border-slate-100 p-2.5 sm:block">
              <p className="text-[11px] font-bold text-ink-950">Pipeline de recrutamento</p>
              {pipeline.map(([label, value, width], index) => (
                <div key={label} className="mt-2.5 grid grid-cols-[4.25rem_1fr_auto] items-center gap-2">
                  <span className="text-[10px] text-ink-600">{label}</span>
                  <span className="h-1.5 rounded-full bg-slate-100">
                    <span
                      className={`block h-1.5 rounded-full ${index < 2 ? 'bg-ink-800' : 'bg-gold-600'}`}
                      style={{ width: `${width}%` }}
                    />
                  </span>
                  <span className="text-[10px] font-semibold text-ink-950">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlatformMockup() {
  const columns = [
    { title: 'Em triagem', count: 327, people: [['Carla Mendes', 'Analista de Marketing'], ['Rafael Souza', 'Desenvolvedor Full Stack'], ['Juliana Alves', 'Analista Financeiro']] },
    { title: 'Entrevista', count: 86, people: [['Lucas Pereira', 'Analista de RH'], ['Fernanda Lima', 'Operadora de Logística'], ['Paulo Henrique', 'Vendedor']] },
    { title: 'Proposta', count: 54, people: [['Camila Rocha', 'Coordenadora de TI'], ['Tiago Santos', 'Supervisor de Loja'], ['Marina Oliveira', 'Analista de Dados']] },
  ]
  const phoneJobs = [
    ['Atendente de Restaurante', 'Curitiba, PR', 'Contratação imediata'],
    ['Auxiliar de Operações', 'São Paulo, SP', 'Em andamento'],
    ['Operador de Loja', 'Belo Horizonte, MG', 'Nova oportunidade'],
  ]

  return (
    <div
      role="img"
      aria-label="Plataforma AK Talent no notebook e no celular, com candidatos organizados por etapa"
      className="relative mx-auto w-full max-w-[42rem] sm:pb-8 sm:pt-10"
    >
      {/* Laptop: the base is as wide as this group and the screen is inset, so nothing overhangs the section. */}
      <div className="sm:mr-[19%]">
        <div className="mx-[3.5%] rounded-t-2xl bg-ink-950 p-2 shadow-2xl shadow-ink-950/25 sm:p-2.5">
          <div className="overflow-hidden rounded-lg bg-white">
            <AppTopBar />
            <div className="grid sm:grid-cols-[7rem_1fr] lg:grid-cols-1 xl:grid-cols-[7rem_1fr]">
              <AppSidebar active="Candidatos" className="hidden sm:block lg:hidden xl:block" />
              <div className="min-w-0 bg-white p-3">
                <p className="text-sm font-bold text-ink-950">Candidatos</p>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {columns.map((column, columnIndex) => (
                    <div key={column.title} className="min-w-0 rounded-lg bg-slate-50 p-1.5 sm:p-2">
                      <p className="truncate text-[10px] font-semibold text-ink-800">
                        {column.title} <span className="text-ink-400">({column.count})</span>
                      </p>
                      {column.people.map(([name, role], index) => (
                        <div key={name} className="mt-1.5 flex items-center gap-1.5 rounded-md border border-slate-100 bg-white p-1.5">
                          <Avatar name={name} index={index + columnIndex} />
                          <div className="min-w-0 leading-tight">
                            <p className="truncate text-[10px] font-semibold text-ink-950">{name}</p>
                            <p className="truncate text-[9px] text-ink-400">{role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="relative h-3 rounded-b-2xl bg-gradient-to-b from-slate-200 to-slate-400 shadow-lg shadow-ink-950/20">
          <span className="absolute left-1/2 top-0 h-1.5 w-20 -translate-x-1/2 rounded-b-md bg-slate-400/60" />
        </div>
      </div>

      <div className="absolute bottom-0 right-0 hidden w-[29%] min-w-36 max-w-44 rounded-[1.6rem] border-[5px] border-ink-950 bg-white p-2.5 shadow-2xl shadow-ink-950/30 sm:block">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200" />
        <p className="text-[11px] font-bold text-ink-950">AK Talent</p>
        <div className="mt-2 grid grid-cols-2 gap-1 text-center text-[9px] font-semibold">
          <span className="rounded-md bg-ink-950 py-1 text-white">Vagas</span>
          <span className="rounded-md bg-slate-100 py-1 text-ink-600">Candidatos</span>
        </div>
        {phoneJobs.map(([title, location, status]) => (
          <div key={title} className="mt-1.5 rounded-md border border-slate-100 p-1.5">
            <p className="text-[10px] font-semibold leading-tight text-ink-950">{title}</p>
            <p className="mt-0.5 text-[9px] text-ink-400">{location}</p>
            <span className="mt-1.5 inline-flex rounded bg-gold-50 px-1.5 py-0.5 text-[8px] font-semibold text-gold-800">{status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VideoPlaceholder() {
  return (
    <div className="relative overflow-hidden rounded-xl bg-ink-950 shadow-2xl shadow-ink-950/20">
      <img
        src={videoThumbnailImage}
        alt="Executiva da AK Talent em thumbnail de vídeo institucional"
        className="aspect-[16/10] w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/45 via-transparent to-transparent" />
      {/* Sits exactly over the play mark printed on the thumbnail, so only one play button shows. */}
      <button
        type="button"
        title="Vídeo institucional em produção"
        aria-label="Assistir vídeo institucional"
        className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ink-950/70 text-white ring-2 ring-white/90 backdrop-blur-sm transition hover:scale-105 hover:bg-gold-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-300"
      >
        <Icon name="play" className="ml-1 h-8 w-8 fill-current" />
      </button>
      <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-md bg-ink-950/75 px-2.5 py-1 text-xs font-semibold text-white">
        <Icon name="play" className="h-3 w-3 fill-current" />
        0:58
      </span>
    </div>
  )
}

// Sample jobs are a local-development aid only; production builds never show them.
function useFeaturedJobs(allowDemoJobs: boolean = import.meta.env.DEV) {
  const [jobs, setJobs] = useState<FeaturedJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [mode, setMode] = useState<FeaturedJobsMode>('live')

  useEffect(() => {
    let isMounted = true

    getJobs()
      .then((response) => {
        if (!isMounted) {
          return
        }

        const mapped = response.slice(0, 4).map((job: Job) => ({
          title: job.title,
          location: job.location || 'Localização a confirmar',
          workMode: formatWorkMode(job.work_mode) || 'Modalidade a confirmar',
          company: 'AK Talent',
          status: job.status || 'Recebendo candidatos',
          area: job.status || 'Vaga ativa',
          slug: job.slug,
        }))

        const nextMode = resolveFeaturedJobsMode(mapped.length, allowDemoJobs)
        setMode(nextMode)
        setJobs(nextMode === 'live' ? mapped : nextMode === 'demo' ? fallbackJobs : [])
      })
      .catch(() => {
        if (isMounted) {
          const nextMode = resolveFeaturedJobsMode(null, allowDemoJobs)
          setMode(nextMode)
          setJobs(nextMode === 'demo' ? fallbackJobs : [])
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [allowDemoJobs])

  return { jobs, isLoading, mode }
}

// True while the final CTA band or the footer is on screen.
function useClosingAreaInView() {
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const targets = [document.getElementById('conversa'), document.querySelector('footer')].filter(
      (el): el is HTMLElement => el !== null,
    )
    if (!targets.length || typeof IntersectionObserver === 'undefined') return

    const visibleTargets = new Set<Element>()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visibleTargets.add(entry.target)
        else visibleTargets.delete(entry.target)
      }
      setInView(visibleTargets.size > 0)
    })
    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return inView
}

// Compact launcher: appears only after the hero CTA has scrolled away and hides again over the
// final CTA/footer, so it never competes with another chat button or covers content.
// On phones it collapses to an icon.
function FloatingChatPrompt() {
  const closingAreaInView = useClosingAreaInView()
  const visible = useScrolledPast(560) && !closingAreaInView

  return (
    <div
      className={`fixed bottom-4 right-4 z-30 transition duration-300 sm:bottom-6 sm:right-6 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <AppIntelliButton
        cta="floatingChat"
        leading={<Icon name="chat" className="h-5 w-5 shrink-0" />}
        labelClassName="sr-only sm:not-sr-only"
        className="inline-flex h-14 w-14 items-center justify-center gap-2 rounded-full bg-gold-700 text-sm font-semibold text-white shadow-xl shadow-ink-950/25 ring-4 ring-white transition hover:-translate-y-0.5 hover:bg-gold-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600 sm:h-12 sm:w-auto sm:px-5"
      />
    </div>
  )
}

function FeaturedJobsSection() {
  const { jobs, isLoading, mode } = useFeaturedJobs()
  const showUnavailable = !isLoading && mode === 'unavailable'

  return (
    <section id="vagas-destaque" className="bg-slate-50 py-16 sm:py-20">
      <Container>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className={eyebrowPill}>Vagas em destaque</h2>
            <p className="mt-3 text-base text-ink-600">
              {mode === 'demo'
                ? 'Exemplos de formatos de vagas que podem ser gerenciadas pela AK Talent.'
                : mode === 'unavailable'
                  ? 'Acompanhe por aqui as oportunidades gerenciadas pela AK Talent.'
                  : 'Algumas das vagas que estão sendo gerenciadas pela AK Talent.'}
            </p>
          </div>
          {showUnavailable ? null : (
            <Link
              to="/vagas"
              className="inline-flex items-center gap-2 text-sm font-semibold text-gold-800 transition hover:text-ink-950"
            >
              Ver todas as vagas <Icon name="arrow" className="h-4 w-4" />
            </Link>
          )}
        </div>

        {showUnavailable ? (
          <div className="mt-8">
            <JobsUnavailableNotice />
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isLoading ? (
              <div className="col-span-full">
                <LoadingHint label="Carregando vagas..." />
              </div>
            ) : null}
            {isLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-52 animate-pulse rounded-xl border border-slate-200 bg-white" />
                ))
              : jobs.map((job) => (
                  <article
                    key={`${job.title}-${job.location}`}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold-50 text-gold-700">
                        <Icon name={areaIcons[job.area] ?? 'briefcase'} className="h-4 w-4" />
                      </span>
                      <p className="text-xs font-semibold text-ink-800">{job.area}</p>
                    </div>
                    <h3 className="mt-4 font-display text-lg font-bold leading-snug text-ink-950">{job.title}</h3>
                    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-600">
                      <Icon name="pin" className="h-4 w-4 shrink-0 text-ink-400" />
                      {job.location}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                      <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-emerald-700">{job.status}</span>
                      <span className="rounded-md border border-slate-200 px-2.5 py-1 text-ink-600">{job.workMode}</span>
                    </div>
                    <Link
                      to={job.slug ? `/vagas/${job.slug}` : '/vagas'}
                      className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-gold-800 transition hover:text-ink-950"
                    >
                      Ver vaga <Icon name="arrow" className="h-4 w-4" />
                    </Link>
                  </article>
                ))}
          </div>
        )}
      </Container>
    </section>
  )
}

function MarketingLanding({ campaign = false }: MarketingLandingProps) {
  return (
    <div className="bg-white">
      <section id="inicio" className="relative overflow-hidden bg-[#f5f7fa]">
        {/* Desktop: the office photo bleeds to the right edge and sits behind the transparent header. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[60%] lg:block">
          <img src={heroOfficeImage} alt="" className="h-full w-full object-cover object-[80%_center]" />
          <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-[#f5f7fa] to-transparent" />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/70 to-transparent" />
        </div>

        <Container className="relative grid gap-10 pb-12 pt-28 lg:min-h-[44rem] lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-8 lg:pb-14 lg:pt-28">
          <div className="min-w-0 lg:max-w-[36rem]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-800">
              {campaign ? 'Solução de recrutamento para empresas' : 'Recrutamento para empresas que crescem'}
            </p>
            <h1 className="mt-5 font-display text-[2.4rem] font-bold leading-[1.06] tracking-[-0.03em] text-ink-950 sm:text-5xl lg:text-[2.9rem] xl:text-[3.3rem]">
              Encontre os melhores talentos <span className="block text-gold-600">sem perder o controle.</span>
            </h1>
            <p className="mt-6 max-w-[31rem] text-lg leading-8 text-ink-600">
              Publique vagas, organize candidatos e acompanhe todo o processo de contratação em um só lugar, com tecnologia para organizar e pessoas para decidir.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-start xl:flex-row">
              <AppIntelliButton
                cta="heroDemo"
                className={`${buttonPrimary} w-full sm:w-auto`}
                leading={<Icon name="chat" className="h-5 w-5" />}
                trailing={<Icon name="arrow" className="h-4 w-4" />}
              />
              <a href="#como-funciona" className={buttonSecondary}>
                <Icon name="playCircle" className="h-5 w-5" />
                Ver como funciona
              </a>
            </div>
          </div>

          <div className="relative min-w-0 lg:self-end">
            <img
              src={heroOfficeImage}
              alt="Profissional de RH usando a plataforma AK Talent em um escritório moderno"
              className="aspect-[4/3] w-full rounded-2xl object-cover object-[70%_center] sm:aspect-[16/10] lg:hidden"
            />
            <div className="relative -mt-24 px-3 sm:-mt-32 sm:px-10 lg:mt-0 lg:ml-auto lg:max-w-[27rem] lg:px-0 xl:max-w-[34rem]">
              <HeroDashboard />
            </div>
          </div>
        </Container>
      </section>

      <section id="segmentos" className="border-b border-slate-200 bg-white py-8 sm:py-10">
        <Container>
          <div className="grid gap-7 lg:grid-cols-[16rem_1fr] lg:items-center">
            <div className="lg:border-r lg:border-slate-200 lg:pr-8">
              <h2 className="font-display text-xl font-bold leading-snug text-ink-950">Soluções para diferentes segmentos</h2>
              <p className="mt-1.5 text-sm text-ink-600">Atendemos empresas de diversos setores e tamanhos.</p>
            </div>
            <ul className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-5 lg:grid-cols-9">
              {segments.map((segment) => (
                <li key={segment.label} className="grid justify-items-center gap-2 text-center">
                  <Icon name={segment.icon} className="h-7 w-7 text-ink-800" />
                  <span className="text-[13px] text-ink-600">{segment.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section
        id="plataforma"
        className="overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f5f7fa_100%)] py-16 sm:py-20 lg:py-24"
      >
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className={eyebrowPill}>Plataforma completa</p>
            <h2 className={`mt-4 ${sectionTitle}`}>Tudo o que sua empresa precisa para recrutar melhor.</h2>
            <p className="mt-5 text-lg leading-8 text-ink-600">
              Organize vagas, candidatos, entrevistas e contratações com mais eficiência e menos trabalho operacional.
            </p>
            <ul className="mt-7 grid gap-3.5">
              {platformFeatures.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold-600 text-white">
                    <Icon name="check" className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-base text-ink-800">{feature}</span>
                </li>
              ))}
            </ul>
            <a href="#como-funciona" className={`${buttonNavy} mt-8`}>
              <Icon name="playCircle" className="h-5 w-5" />
              Conheça a plataforma
              <Icon name="arrow" className="h-4 w-4" />
            </a>
          </div>
          <PlatformMockup />
        </Container>
      </section>

      <section id="sobre" className="relative overflow-hidden bg-ink-950 text-white">
        <div aria-hidden="true" className="absolute inset-y-0 right-0 hidden w-[52%] lg:block">
          <img src={enterpriseImage} alt="" className="h-full w-full object-cover object-[78%_center]" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/55 to-ink-950/10" />
        </div>
        <img
          src={enterpriseImage}
          alt="Equipe de RH colaborando em escritório corporativo da AK Talent"
          className="aspect-[16/9] w-full object-cover object-[70%_center] lg:hidden"
        />

        <Container className="relative py-14 sm:py-16 lg:py-20">
          <div className="lg:max-w-[40rem]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-300">
              Feito para operações de recrutamento de todos os tamanhos
            </p>
            <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-[-0.02em] sm:text-4xl">
              Pronto para grandes operações de contratação?
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3 sm:gap-5">
              {enterpriseHighlights.map((item) => (
                <article key={item.title} className="flex gap-3 sm:block">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold-300/60 text-gold-300">
                    <Icon name={item.icon} className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-white sm:mt-3">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{item.text}</p>
                  </div>
                </article>
              ))}
            </div>
            <dl className="mt-9 grid grid-cols-2 gap-y-5 border-t border-white/10 pt-7 sm:grid-cols-4">
              {enterpriseMetrics.map((metric) => (
                <div key={metric.label} className="sm:border-r sm:border-white/10 sm:px-4 sm:first:pl-0 sm:last:border-r-0">
                  <dt className="sr-only">{metric.label}</dt>
                  <dd className="font-display text-2xl font-bold text-gold-300">{metric.value}</dd>
                  <dd className="mt-0.5 text-xs text-slate-300">{metric.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </section>

      <section id="como-funciona" className="bg-white py-16 sm:py-20 lg:py-24">
        <Container className="grid gap-10 lg:grid-cols-[0.95fr_1.3fr_0.8fr] lg:items-center lg:gap-10">
          <div>
            <p className={eyebrowPill}>Vídeo institucional</p>
            <h2 className={`mt-4 ${sectionTitle}`}>Veja a AK Talent em ação</h2>
            <p className="mt-5 text-base leading-7 text-ink-600">
              Do anúncio da vaga à contratação, conheça na prática como nossa plataforma ajuda sua empresa a ganhar tempo e contratar melhor.
            </p>
            <button type="button" title="Vídeo institucional em produção" className={`${buttonNavy} mt-7`}>
              <Icon name="playCircle" className="h-5 w-5" />
              Assistir vídeo (0:58)
            </button>
          </div>
          <VideoPlaceholder />
          <ul className="grid gap-6">
            {videoPoints.map((point) => (
              <li key={point.text} className="flex items-center gap-4">
                <Icon name={point.icon} className="h-8 w-8 shrink-0 text-gold-600" />
                <span className="text-base leading-6 text-ink-800">{point.text}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <FeaturedJobsSection />

      <section id="conversa" className="relative bg-[linear-gradient(180deg,#0b1f35_0%,#061424_100%)] text-white">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-600/60 to-transparent"
        />
        <Container className="relative flex flex-col gap-8 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <span aria-hidden="true" className="block h-1 w-10 rounded-full bg-gold-600" />
            <h2 className="mt-5 font-display text-3xl font-bold leading-tight tracking-[-0.02em] sm:text-4xl">
              Sua próxima contratação pode começar aqui.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              Converse com a AK Talent e descubra como podemos ajudar sua empresa a contratar melhor.
            </p>
          </div>
          <AppIntelliButton
            cta="finalDemo"
            className={buttonPrimary}
            leading={<Icon name="chat" className="h-5 w-5" />}
            trailing={<Icon name="arrow" className="h-4 w-4" />}
          />
        </Container>
      </section>

      <FloatingChatPrompt />
    </div>
  )
}

export function HomePage() {
  return <MarketingLanding />
}

export function RecruitmentSolutionPage() {
  return <MarketingLanding campaign />
}
