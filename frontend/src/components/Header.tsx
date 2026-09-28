import { AppIntelliButton } from './AppIntelliButton'
import { Container } from './Container'
import { Logo } from './Logo'

const navLinks = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#empresas', label: 'Empresas' },
  { href: '#profissionais', label: 'Profissionais' },
  { href: '#sobre', label: 'Sobre' },
]

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
      <Container className="flex h-24 items-center justify-between gap-6">
        <Logo />

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Principal">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[15px] font-semibold text-ink-700 transition hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <AppIntelliButton
          cta="headerContact"
          className="hidden min-h-12 shrink-0 items-center justify-center rounded-lg bg-ink-950 px-5 text-sm font-black [color:white] shadow-sm transition hover:bg-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 sm:inline-flex"
        />
      </Container>
    </header>
  )
}
