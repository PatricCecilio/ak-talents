import { useLocation } from 'react-router-dom'
import { useScrolledPast } from '../hooks/useScrolledPast'
import { Container } from './Container'
import { Logo } from './Logo'

const navLinks = [
  { href: '/solucoes/recrutamento', label: 'Soluções' },
  { href: '/#plataforma', label: 'Para empresas' },
  { href: '/vagas', label: 'Vagas' },
  { href: '/#como-funciona', label: 'Como funciona' },
  { href: '/#sobre', label: 'Sobre' },
]

export function Header() {
  const location = useLocation()
  const isLanding = location.pathname === '/' || location.pathname === '/solucoes/recrutamento'
  const scrolled = useScrolledPast(24)
  // Landing pages start with a transparent header over the hero and gain a surface once scrolled.
  const transparent = isLanding && !scrolled

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 border-b transition-colors duration-300 ${
        transparent
          ? 'border-transparent bg-transparent'
          : isLanding
            ? 'border-slate-200/70 bg-white/85 shadow-sm backdrop-blur-md'
            : 'border-slate-200/80 bg-white/95 shadow-sm backdrop-blur'
      }`}
    >
      <Container className="flex h-20 items-center justify-between gap-6 lg:h-24">
        <Logo />

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Principal">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[15px] font-medium text-ink-800 transition hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href="/login"
          className="hidden min-h-11 shrink-0 items-center justify-center rounded-lg border border-ink-950/15 bg-white px-6 text-sm font-semibold text-ink-950 shadow-sm transition hover:border-gold-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 sm:inline-flex"
        >
          Entrar
        </a>
      </Container>

      <nav className={`border-t lg:hidden ${transparent ? 'border-ink-950/5' : 'border-slate-200/80'}`} aria-label="Principal mobile">
        <Container>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-ink-700 transition hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
              >
                {link.label}
              </a>
            ))}
          </div>
        </Container>
      </nav>
    </header>
  )
}
