import type { PropsWithChildren } from 'react'
import { Container } from '../components/Container'

interface AuthLayoutProps extends PropsWithChildren {
  title: string
  subtitle: string
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <section className="bg-slate-100 py-10 sm:py-16">
      <Container>
        <div className="mx-auto grid max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-200/70 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="bg-ink-950 p-8 text-white sm:p-10">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-400">AK Talents</p>
            <h1 className="mt-6 text-3xl font-black leading-tight sm:text-4xl">{title}</h1>
            <p className="mt-4 text-base leading-7 text-slate-300">{subtitle}</p>

            <div className="mt-10 grid gap-4 text-sm text-slate-300">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                Triagem inteligente para reduzir tempo operacional.
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                Jornada preparada para candidatos e empresas.
              </div>
            </div>
          </aside>

          <div className="p-6 sm:p-10">{children}</div>
        </div>
      </Container>
    </section>
  )
}
