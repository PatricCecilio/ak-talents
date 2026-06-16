import { useState } from 'react'
import heroImage from '../assets/ak-talent-hero.png'
import { Container } from '../components/Container'
import { Button } from '../components/ui/Button'

const problems = [
  'Muitos currículos para analisar',
  'Pouco tempo para entrevistar',
  'Dificuldade em encontrar o perfil certo',
]

const solutions = [
  'IA cria vagas profissionais',
  'Match inteligente candidato/vaga',
  'Ranking automático de talentos',
  'Testes técnicos por linguagem',
  'Seleção assistida por IA + humano',
]

const aboutItems = [
  'Processos mais claros para empresas que precisam contratar com qualidade.',
  'Experiência mais orientada para profissionais em busca de oportunidades melhores.',
  'Inteligência artificial aplicada ao recrutamento sem perder o olhar humano.',
]

const formInitialState = {
  name: '',
  company: '',
  email: '',
  whatsapp: '',
  type: 'Empresa',
  message: '',
}

type WaitlistForm = typeof formInitialState

export function HomePage() {
  const [form, setForm] = useState<WaitlistForm>(formInitialState)
  const [submitted, setSubmitted] = useState(false)

  function updateForm(field: keyof WaitlistForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const entries = JSON.parse(localStorage.getItem('ak_talents_waitlist') || '[]') as WaitlistForm[]
    localStorage.setItem('ak_talents_waitlist', JSON.stringify([...entries, form]))
    setSubmitted(true)
    setForm(formInitialState)
  }

  return (
    <div className="bg-white">
      <section id="inicio" className="overflow-hidden bg-white">
        <Container className="grid min-h-[calc(100svh-5rem)] items-center gap-12 py-14 lg:grid-cols-[0.95fr_1.05fr] lg:py-20">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-500">Recrutamento Inteligente com IA</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[1.02] text-ink-950 sm:text-6xl lg:text-7xl">
              AK Talents
            </h1>
            <p className="mt-6 max-w-2xl text-xl font-bold leading-8 text-ink-800">
              Recrutamento inteligente com IA para empresas e profissionais.
            </p>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-ink-600">
              A AK Talents utiliza inteligência artificial para ajudar empresas a encontrar profissionais qualificados e
              candidatos a encontrarem melhores oportunidades.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#lista-espera"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-700 px-6 text-sm font-black text-white shadow-lg shadow-slate-900/10 transition hover:bg-brand-600"
              >
                Solicitar demonstração
              </a>
              <a
                href="#solucoes"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-6 text-sm font-black text-ink-800 transition hover:border-gold-500 hover:text-ink-950"
              >
                Entrar na lista de espera
              </a>
              <a
                href="#contato"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-6 text-sm font-black text-ink-800 transition hover:border-gold-500 hover:text-ink-950"
              >
                Falar com especialista
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 top-8 hidden rounded-lg border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/80 lg:block">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-ink-400">Ranking IA</p>
              <p className="mt-1 text-2xl font-black text-gold-500">94%</p>
            </div>
            <img
              src={heroImage}
              alt="Profissionais usando uma plataforma de recrutamento com IA"
              className="aspect-[4/3] w-full rounded-lg object-cover shadow-2xl shadow-slate-300"
            />
          </div>
        </Container>
      </section>

      <section className="bg-slate-50 py-16">
        <Container>
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-500">Problema</p>
            <h2 className="mt-3 text-3xl font-black text-ink-950 sm:text-4xl">Contratar ainda é lento, manual e caro.</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {problems.map((problem) => (
              <article key={problem} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-gold-400/20 text-lg font-black text-gold-500">
                  !
                </span>
                <h3 className="mt-5 text-lg font-black text-ink-950">{problem}</h3>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section id="solucoes" className="bg-white py-16">
        <Container>
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-500">Soluções</p>
            <h2 className="mt-3 text-3xl font-black text-ink-950 sm:text-4xl">A IA apoia o processo do início ao fim</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {solutions.map((solution, index) => (
              <article key={solution} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-black text-gold-500">0{index + 1}</p>
                <h3 className="mt-4 text-base font-black leading-6 text-ink-950">{solution}</h3>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-ink-950 py-16 text-white">
        <Container className="grid gap-6 lg:grid-cols-2">
          <article id="empresas" className="rounded-lg border border-white/10 bg-white/5 p-8">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-400">Empresas</p>
            <h2 className="mt-4 text-3xl font-black">Crie vagas com ajuda da IA e encontre profissionais mais aderentes.</h2>
            <p className="mt-5 leading-7 text-slate-300">
              Estruture vagas melhores, compare candidatos com mais clareza e priorize entrevistas com base em aderência real ao perfil.
            </p>
          </article>
          <article id="profissionais" className="rounded-lg border border-white/10 bg-white/5 p-8">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-400">Profissionais</p>
            <h2 className="mt-4 text-3xl font-black">
              Cadastre seu perfil, melhore seu currículo com IA e encontre oportunidades compatíveis.
            </h2>
            <p className="mt-5 leading-7 text-slate-300">
              Receba uma experiência mais orientada, com perfil profissional melhor preparado para as oportunidades certas.
            </p>
          </article>
        </Container>
      </section>

      <section id="sobre" className="bg-slate-50 py-16">
        <Container>
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-500">Sobre</p>
            <h2 className="mt-3 text-3xl font-black text-ink-950 sm:text-4xl">Tecnologia para aproximar empresas e talentos.</h2>
            <p className="mt-5 leading-7 text-ink-600">
              A AK Talents nasce para tornar o recrutamento mais inteligente, prático e humano, combinando dados,
              automação e análise assistida por inteligência artificial.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {aboutItems.map((item) => (
              <article key={item} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <p className="leading-7 text-ink-700">{item}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-white py-16">
        <Container className="rounded-lg bg-ink-950 px-6 py-12 text-center text-white sm:px-10">
          <h2 className="text-3xl font-black sm:text-4xl">Quer contratar melhor com IA?</h2>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="#lista-espera"
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-gold-500 px-6 text-sm font-black text-ink-950 transition hover:bg-gold-400"
            >
              Solicitar demonstração
            </a>
            <a
              href="#contato"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/20 px-6 text-sm font-black text-white transition hover:border-gold-400 hover:text-gold-400"
            >
              Falar com especialista
            </a>
          </div>
        </Container>
      </section>

      <section id="contato" className="bg-slate-50 py-16">
        <Container className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p id="lista-espera" className="text-sm font-black uppercase tracking-[0.22em] text-gold-500">
              Lista de espera
            </p>
            <h2 className="mt-3 text-3xl font-black text-ink-950 sm:text-4xl">Fale com a AK Talents</h2>
            <p className="mt-5 leading-7 text-ink-600">
              Conte um pouco sobre sua empresa ou perfil. Por enquanto, a inscrição fica salva neste navegador e a página
              funciona sem backend.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-ink-800">
                Nome
                <input
                  required
                  value={form.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-4 text-ink-950 outline-none transition focus:border-brand-600"
                />
              </label>
              <label className="text-sm font-bold text-ink-800">
                Empresa
                <input
                  value={form.company}
                  onChange={(event) => updateForm('company', event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-4 text-ink-950 outline-none transition focus:border-brand-600"
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-ink-800">
                Email
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm('email', event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-4 text-ink-950 outline-none transition focus:border-brand-600"
                />
              </label>
              <label className="text-sm font-bold text-ink-800">
                WhatsApp
                <input
                  value={form.whatsapp}
                  onChange={(event) => updateForm('whatsapp', event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-4 text-ink-950 outline-none transition focus:border-brand-600"
                />
              </label>
            </div>
            <label className="text-sm font-bold text-ink-800">
              Tipo
              <select
                value={form.type}
                onChange={(event) => updateForm('type', event.target.value)}
                className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-4 text-ink-950 outline-none transition focus:border-brand-600"
              >
                <option>Empresa</option>
                <option>Profissional</option>
              </select>
            </label>
            <label className="text-sm font-bold text-ink-800">
              Mensagem
              <textarea
                value={form.message}
                onChange={(event) => updateForm('message', event.target.value)}
                className="mt-2 min-h-32 w-full resize-y rounded-lg border border-slate-300 p-4 text-ink-950 outline-none transition focus:border-brand-600"
              />
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="submit" className="sm:w-auto">
                Entrar na lista de espera
              </Button>
              <a
                href="#contato"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-ink-800 transition hover:border-gold-500 hover:text-ink-950"
              >
                Falar com especialista
              </a>
            </div>
            {submitted ? (
              <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                Inscrição recebida com sucesso. Obrigado pelo interesse na AK Talents.
              </p>
            ) : null}
          </form>
        </Container>
      </section>
    </div>
  )
}
