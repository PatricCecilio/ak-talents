import type { PropsWithChildren } from 'react'
import { Container } from '../components/Container'
import { getCurrentUser } from '../services/authService'

interface DashboardShellProps extends PropsWithChildren {
  active: 'candidate' | 'company' | 'admin'
}

// Each item jumps to a section of the same page.
const navItems = {
  candidate: [
    { href: '#candidaturas', label: 'Minhas candidaturas' },
    { href: '#perfil', label: 'Meu perfil' },
    { href: '#vagas', label: 'Vagas' },
  ],
  company: [
    { href: '#finalistas', label: 'Finalistas' },
    { href: '#nova-vaga', label: 'Nova vaga' },
    { href: '#suas-vagas', label: 'Suas vagas' },
  ],
  admin: [
    { href: '#resumo', label: 'Resumo' },
    { href: '#empresas', label: 'Empresas' },
    { href: '#vagas', label: 'Vagas' },
    { href: '#candidatos', label: 'Candidatos' },
    { href: '#candidaturas', label: 'Candidaturas' },
  ],
}

const roleLabels = {
  candidate: 'Candidato',
  company: 'Empresa',
  admin: 'Administração',
}

export function DashboardShell({ active, children }: DashboardShellProps) {
  const user = getCurrentUser()

  return (
    <section className="bg-slate-100 py-6 sm:py-8">
      <Container>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-28 lg:h-[calc(100svh-8rem)]">
            <div className="rounded-lg bg-ink-950 p-4 text-white">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-gold-400">AK Talent</p>
              <p className="mt-3 text-lg font-black">{user?.name || 'Dashboard'}</p>
              <p className="mt-1 text-sm text-slate-300">{roleLabels[active]}</p>
            </div>

            <nav className="mt-4 flex gap-2 overflow-x-auto lg:grid lg:overflow-visible" aria-label="Dashboard">
              {navItems[active].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-lg px-4 py-3 text-sm font-black text-ink-600 transition hover:bg-slate-100 hover:text-ink-950"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </Container>
    </section>
  )
}
