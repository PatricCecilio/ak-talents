import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import type { PanelContext } from './panelContext'
import { NavLink, Outlet } from 'react-router-dom'
import { LoginNotice } from '../components/LoginNotice'
import { getCurrentUser, logout } from '../services/authService'
import { doorPathForRole } from '../services/loginDoors'
import { getOverview } from './panelApi'
import { PANEL_BASE, ROLE_LABELS, initials, panelMenu, type PanelMenuItem } from './panelFormat'
import { PanelIcon } from './PanelUi'
import { panelFocus } from './panelStyles'
import { PanelSearch } from './PanelSearch'

function MenuLink({ item, count, onNavigate }: { item: PanelMenuItem; count: number; onNavigate: () => void }) {
  const content = (
    <>
      <PanelIcon name={item.icon} className="h-5 w-5 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.soon ? <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">em breve</span> : null}
      {item.badge && count > 0 ? (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold-400 px-1.5 text-[11px] font-bold text-ink-950">{count}</span>
      ) : null}
    </>
  )
  const base = 'flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition'
  if (item.soon) {
    return (
      <span aria-disabled="true" title="Chega na próxima etapa do painel novo" className={`${base} cursor-not-allowed text-slate-500`}>
        {content}
      </span>
    )
  }
  return (
    <NavLink
      to={item.to}
      end={item.to === PANEL_BASE}
      onClick={onNavigate}
      className={({ isActive }) =>
        `${base} ${panelFocus} ${isActive ? 'border-l-4 border-gold-400 bg-white/10 pl-2 text-white' : 'text-slate-200 hover:bg-white/5 hover:text-white'}`
      }
    >
      {content}
    </NavLink>
  )
}

// AK team panel (admin and recruiters). Desktop (>=1280px): fixed sidebar; when the window is also tall enough ("fit",
// see index.css) the page stays still and lists/board columns scroll inside; shorter windows scroll the page normally.
// Phones and tablets: the menu becomes ☰ and the page scrolls.
export function PanelLayout() {
  const user = getCurrentUser()
  const role = user?.role ?? 'recruiter'
  const menu = panelMenu(role)
  const [actions, setActions] = useState<ReactNode>(null)
  const [drawer, setDrawer] = useState(false)
  const [toTriage, setToTriage] = useState(0)

  const refreshCounts = useCallback(() => {
    getOverview()
      .then((overview) => setToTriage(overview.cards.to_triage))
      .catch(() => setToTriage(0))
  }, [])

  useEffect(() => {
    refreshCounts()
  }, [refreshCounts])

  const sidebar = (
    <div className="flex h-full flex-col bg-ink-900 px-4 py-5 text-white">
      <div className="flex items-center gap-3 px-2">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-gold-400 font-display text-sm font-extrabold text-ink-950">AK</span>
        <span className="font-display text-xl font-bold">AK Talent</span>
      </div>
      <nav aria-label="Painel" className="mt-8 grid gap-1">
        {menu.main.map((item) => (
          <MenuLink key={item.to} item={item} count={toTriage} onNavigate={() => setDrawer(false)} />
        ))}
        {menu.admin.length ? (
          <>
            <p className="mt-5 px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Administração</p>
            {menu.admin.map((item) => (
              <MenuLink key={item.to} item={item} count={0} onNavigate={() => setDrawer(false)} />
            ))}
          </>
        ) : null}
      </nav>
      <div className="mt-auto flex items-center gap-3 border-t border-white/10 px-2 pt-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-300 text-sm font-bold text-ink-950">{initials(user?.name)}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold">{user?.name}</span>
          <span className="block text-xs text-slate-300">{ROLE_LABELS[role] ?? ''}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            logout()
            window.location.href = doorPathForRole(role)
          }}
          className={`rounded-lg px-2 py-1 text-sm text-slate-300 transition hover:text-white ${panelFocus}`}
        >
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-svh bg-[#f6f3ee] xl:flex fit:h-svh fit:overflow-hidden">
      <meta name="robots" content="noindex, nofollow" />
      <aside className="hidden w-64 shrink-0 xl:sticky xl:top-0 xl:block xl:h-svh">{sidebar}</aside>

      {drawer ? (
        <div className="fixed inset-0 z-50 flex xl:hidden" onClick={() => setDrawer(false)}>
          <div className="h-full w-72 max-w-[85vw]" onClick={(event) => event.stopPropagation()}>
            {sidebar}
          </div>
          <div className="flex-1 bg-ink-950/40" />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col fit:min-h-0">
        <header className="sticky top-0 z-30 flex min-h-14 flex-wrap items-center gap-3 border-b border-[#e7e1d6] bg-white px-4 py-2 sm:px-6">
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setDrawer(true)}
            className={`grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-ink-950 xl:hidden ${panelFocus}`}
          >
            <PanelIcon name="menu" />
          </button>
          <div className="min-w-0 flex-1 basis-56 xl:max-w-xl">
            <PanelSearch />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
        </header>
        <main className="relative flex min-w-0 flex-col gap-3 px-4 py-4 sm:px-6 fit:min-h-0 fit:flex-1 fit:overflow-y-auto">
          <LoginNotice />
          <Outlet context={{ setActions, refreshCounts } satisfies PanelContext} />
        </main>
      </div>
    </div>
  )
}
