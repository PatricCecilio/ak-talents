import { Link, useLocation } from 'react-router-dom'
import { Container } from '../components/Container'
import { DOOR_PATHS } from '../services/loginDoors'

const choices = [
  {
    to: DOOR_PATHS.candidato,
    label: 'Sou candidato',
    description: 'Quero acompanhar minhas candidaturas.',
    icon: (
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
    ),
  },
  {
    to: DOOR_PATHS.empresa,
    label: 'Sou empresa',
    description: 'Quero publicar vagas e acompanhar a seleção.',
    icon: (
      <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M8 8h3M8 12h3M8 16h3M3 21h18" />
    ),
  },
]

// /entrar: who is signing in? Two big choices, each leading to its own login door.
export function LoginChooserPage() {
  // Keep where the person was going (private routes send it) and any message for the next screen.
  const { state } = useLocation()

  return (
    <section className="bg-slate-100 py-10 sm:py-16">
      <Container>
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-700">AK Talent</p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-ink-950 sm:text-4xl">Você é…</h1>
          <p className="mt-3 text-base leading-7 text-ink-600">Escolha uma opção para entrar na sua conta.</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {choices.map((choice) => (
              <Link
                key={choice.to}
                to={choice.to}
                state={state}
                className="group flex min-h-28 items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
              >
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gold-50 text-gold-700">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {choice.icon}
                  </svg>
                </span>
                <span>
                  <span className="block text-xl font-black text-ink-950">{choice.label}</span>
                  <span className="mt-1 block text-sm leading-6 text-ink-600">{choice.description}</span>
                </span>
              </Link>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-ink-600">
            Ainda não tem conta?{' '}
            <Link to="/register" className="font-bold text-brand-700 underline underline-offset-2 hover:text-brand-600">
              Criar conta
            </Link>
          </p>
        </div>
      </Container>
    </section>
  )
}
