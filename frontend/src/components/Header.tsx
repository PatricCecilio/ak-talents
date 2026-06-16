import { Container } from './Container'
import { Logo } from './Logo'

const navLinks = [
  { href: '#inicio', label: 'Início' },
  { href: '#solucoes', label: 'Soluções' },
  { href: '#empresas', label: 'Empresas' },
  { href: '#profissionais', label: 'Profissionais' },
  { href: '#sobre', label: 'Sobre' },
  { href: '#contato', label: 'Contato' },
]

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
      <Container className="flex h-20 items-center justify-between gap-5">
        <Logo />

        <nav className="hidden items-center gap-5 lg:flex" aria-label="Principal">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-ink-600 transition hover:text-brand-700"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="#lista-espera"
            className="inline-flex rounded-lg bg-ink-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-ink-800"
          >
            Lista de espera
          </a>
        </div>
      </Container>
    </header>
  )
}
