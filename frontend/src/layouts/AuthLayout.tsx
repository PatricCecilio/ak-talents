import type { PropsWithChildren } from 'react'
import { Container } from '../components/Container'

interface AuthLayoutProps extends PropsWithChildren {
  title: string
  subtitle: string
  /** The two marketing cards in the dark panel (desktop only). Off for internal areas such as /equipe. */
  showHighlights?: boolean
}

// Desktop: dark panel beside the form. Phones and tablets (< lg): the form comes first, under a thin brand strip and
// a short title, so e-mail, password and the button are visible without scrolling.
export function AuthLayout({ title, subtitle, showHighlights = true, children }: AuthLayoutProps) {
  return (
    <section className="bg-slate-100 py-4 sm:py-10 lg:py-16">
      <Container>
        <div className="mx-auto grid max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-200/70 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="hidden bg-ink-950 p-10 text-white lg:block">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-400">AK Talent</p>
            <h1 className="mt-6 text-4xl font-black leading-tight">{title}</h1>
            <p className="mt-4 text-base leading-7 text-slate-300">{subtitle}</p>

            {showHighlights ? (
              <div className="mt-10 grid gap-4 text-sm text-slate-300">
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  Triagem inteligente para reduzir tempo operacional.
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  Jornada preparada para candidatos e empresas.
                </div>
              </div>
            ) : null}
          </aside>

          <div data-auth-strip className="bg-ink-950 px-5 py-2.5 lg:hidden">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-gold-400">AK Talent</p>
          </div>

          <div className="p-5 sm:p-10">
            <div className="mb-5 lg:hidden">
              <h1 className="text-2xl font-black leading-tight text-ink-950">{title}</h1>
              <p className="mt-1 text-sm leading-6 text-ink-600">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </Container>
    </section>
  )
}
