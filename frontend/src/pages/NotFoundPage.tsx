import { ButtonLink } from '../components/ButtonLink'
import { Container } from '../components/Container'

export function NotFoundPage() {
  return (
    <section className="grid min-h-[60svh] place-items-center py-16">
      <Container className="text-center">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-brand-700">404</p>
        <h1 className="mt-4 text-4xl font-black text-ink-950">Pagina nao encontrada</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-ink-600">
          A rota solicitada nao existe na Fase 1 da AK Talents.
        </p>
        <div className="mt-8">
          <ButtonLink to="/">Voltar para inicio</ButtonLink>
        </div>
      </Container>
    </section>
  )
}
