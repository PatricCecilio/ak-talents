import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Container } from '../components/Container'
import { HireContactLink } from '../components/HireContactLink'
import { Alert } from '../components/ui'
import { COMPANY_PORTAL_CLOSED_MESSAGE, isCompanyPortalEnabled } from '../services/companyPortal'
import { DOOR_PATHS } from '../services/loginDoors'

const candidateChoice = {
  to: DOOR_PATHS.candidato,
  label: 'Sou candidato',
  description: 'Quero acompanhar minhas candidaturas.',
  icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
}

// Old self-service company portal (COMPANY_PORTAL_ENABLED). Off: companies talk to AK ("Quero contratar").
const companyChoice = {
  to: DOOR_PATHS.empresa,
  label: 'Sou empresa',
  description: 'Quero publicar vagas e acompanhar a seleção.',
  icon: <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M8 8h3M8 12h3M8 16h3M3 21h18" />,
}

const choiceClass =
  'group flex min-h-28 items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500'

// /entrar: who is signing in? Candidates get their login door; companies talk to AK.
export function LoginChooserPage() {
  // Keep where the person was going (private routes send it) and any message for the next screen.
  const { state } = useLocation()
  const [searchParams] = useSearchParams()
  const companyPortal = isCompanyPortalEnabled()
  const choices = companyPortal ? [candidateChoice, companyChoice] : [candidateChoice]
  // ?erro=empresa: a company account, an old /entrar/empresa link or the company Google door.
  const companyClosed = !companyPortal && searchParams.get('erro') === 'empresa'

  return (
    <section className="bg-slate-100 py-10 sm:py-16">
      <Container>
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-700">AK Talent</p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-ink-950 sm:text-4xl">Você é…</h1>
          <p className="mt-3 text-base leading-7 text-ink-600">
            {companyPortal ? 'Escolha uma opção para entrar na sua conta.' : 'Candidatos entram aqui. Empresas falam direto com a AK Talent.'}
          </p>

          {companyClosed ? (
            <div className="mt-6">
              <Alert tone="info">{COMPANY_PORTAL_CLOSED_MESSAGE}</Alert>
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {choices.map((choice) => (
              <Link key={choice.to} to={choice.to} state={state} className={choiceClass}>
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
            {companyPortal ? null : <HireContactLink variant="card" />}
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
