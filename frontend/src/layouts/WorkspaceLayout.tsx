import { NavLink, Outlet } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { getCurrentUser, logout } from '../services/authService'

// Internal AK Talent area (recruiters and admin): landing look, no public menu, phone first.
export function WorkspaceLayout() {
  const user = getCurrentUser()
  const links =
    user?.role === 'admin'
      ? [
          { to: '/recrutador', label: 'Recrutamento' },
          { to: '/admin', label: 'Admin' },
        ]
      : [{ to: '/recrutador', label: 'Vagas' }]

  return (
    <div className="min-h-svh bg-[#f5f7fa]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Logo className="h-9" />
          <span className="hidden rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-800 sm:inline">
            Equipe AK Talent
          </span>

          <nav aria-label="Área interna" className="ml-auto flex items-center gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/admin'}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    isActive ? 'bg-ink-950 text-white' : 'text-ink-700 hover:bg-slate-100'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <span className="hidden max-w-40 truncate text-sm text-ink-600 md:block">{user?.name}</span>
          <button
            type="button"
            onClick={() => {
              logout()
              window.location.href = '/login'
            }}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-600"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
