import { Container } from './Container'
import { Logo } from './Logo'

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <Container className="flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between">
        <Logo />
        <p className="max-w-xl text-sm leading-6 text-ink-600">
          AK Talents
          <br />
          Recrutamento Inteligente com IA
        </p>
        <p className="text-sm font-semibold text-ink-400">Empresas e profissionais conectados por IA</p>
      </Container>
    </footer>
  )
}
