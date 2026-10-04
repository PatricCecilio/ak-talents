import { Container } from './Container'
import { Logo } from './Logo'

const footerLinks = [
  { href: '/solucoes/recrutamento', label: 'Soluções' },
  { href: '/#plataforma', label: 'Para empresas' },
  { href: '/vagas', label: 'Vagas' },
  { href: '/#como-funciona', label: 'Como funciona' },
  { href: '/#sobre', label: 'Sobre' },
]

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.2fr_0.8fr_1fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-sm text-base leading-7 text-ink-600">
            Plataforma e operação de recrutamento para empresas que precisam contratar com mais organização.
          </p>
        </div>

        <nav className="flex flex-col gap-3 text-base font-semibold text-ink-600" aria-label="Rodape">
          {footerLinks.map((link) => (
            <a key={link.href} href={link.href} className="transition hover:text-brand-700">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="text-base leading-7 text-ink-600 md:text-right">
          <p className="font-black text-ink-950">AK Talent</p>
          <a href="mailto:contato@aktalent.com.br" className="font-semibold text-brand-700 hover:text-brand-600">
            contato@aktalent.com.br
          </a>
          <p className="mt-5 text-sm text-ink-400">© 2026 AK Talent. Todos os direitos reservados.</p>
        </div>
      </Container>
    </footer>
  )
}
