import { Container } from './Container'
import { Logo } from './Logo'

const footerLinks = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#empresas', label: 'Empresas' },
  { href: '#profissionais', label: 'Profissionais' },
  { href: '#sobre', label: 'Sobre' },
]

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <Container className="grid gap-8 py-10 md:grid-cols-[1.1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-6 text-ink-600">Recrutamento Inteligente com IA</p>
        </div>

        <nav className="flex flex-col gap-3 text-sm font-semibold text-ink-600" aria-label="Rodape">
          {footerLinks.map((link) => (
            <a key={link.href} href={link.href} className="transition hover:text-brand-700">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="text-sm leading-6 text-ink-600">
          <p className="font-black text-ink-950">AK Talent</p>
          <a href="mailto:contato@aktalent.com.br" className="font-semibold text-brand-700 hover:text-brand-600">
            contato@aktalent.com.br
          </a>
          <p className="mt-4 text-ink-400">(c) 2026 AK Talent. Todos os direitos reservados.</p>
        </div>
      </Container>
    </footer>
  )
}
