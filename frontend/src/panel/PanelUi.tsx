import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { panelFocus } from './panelStyles'

// Building blocks of the new panel: same colors as the site (navy ink, bronze gold), cream background.

const ICONS: Record<string, string[]> = {
  home: ['M4 11.5 12 4l8 7.5', 'M6 10v10h12V10', 'M10 20v-6h4v6'],
  building: ['M5 21V4h10v17', 'M15 9h4v12', 'M8 8h4', 'M8 12h4', 'M8 16h4', 'M3 21h18'],
  briefcase: ['M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1', 'M4 7h16v12H4Z', 'M4 12h16'],
  users: ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M2 21a7 7 0 0 1 14 0', 'M16 3.5a4 4 0 0 1 0 7', 'M22 21a7 7 0 0 0-4-6.3'],
  person: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M5 21a7 7 0 0 1 14 0'],
  search: ['M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z', 'M16 16l4 4'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  alert: ['M12 3 2 20h20Z', 'M12 10v4', 'M12 17h.01'],
  chevronLeft: ['M15 6l-6 6 6 6'],
  chevronRight: ['M9 6l6 6-6 6'],
}

export function PanelIcon({ name, className = 'h-5 w-5' }: { name: keyof typeof ICONS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(ICONS[name] ?? []).map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  )
}

export function PanelCard({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex min-h-0 flex-col rounded-2xl border border-[#e7e1d6] bg-white ${className}`}>
      {title || action ? (
        <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 className="font-display text-base font-bold text-ink-950">{title}</h2>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  )
}

export function Pill({ children, tone = 'bg-slate-100 text-ink-700' }: { children: ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{children}</span>
}

/** Small round count ("4", "1"); dash when zero. */
export function CountBadge({ value, tone }: { value: number; tone: string }) {
  if (!value) return <span className="text-ink-400">—</span>
  return <span className={`inline-grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold ${tone}`}>{value}</span>
}

export function PanelPageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink-950 sm:text-[1.7rem]">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const buttonClass = (active: boolean) =>
    `grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm font-semibold transition ${panelFocus} ${
      active ? 'border-ink-950 bg-ink-950 text-white' : 'border-slate-200 bg-white text-ink-700 hover:border-ink-800/40'
    }`
  return (
    <nav aria-label="Páginas" className="flex items-center gap-1.5">
      <button type="button" className={buttonClass(false)} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">
        <PanelIcon name="chevronLeft" className="h-4 w-4" />
      </button>
      {Array.from({ length: pages }, (_, index) => index + 1)
        .filter((number) => number === 1 || number === pages || Math.abs(number - page) <= 1)
        .map((number) => (
          <button key={number} type="button" className={buttonClass(number === page)} onClick={() => onChange(number)} aria-current={number === page ? 'page' : undefined}>
            {number}
          </button>
        ))}
      <button type="button" className={buttonClass(false)} disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Próxima página">
        <PanelIcon name="chevronRight" className="h-4 w-4" />
      </button>
    </nav>
  )
}

export interface MenuAction {
  label: string
  onSelect: () => void
  danger?: boolean
  hint?: string
}

/** "⋯" button with a small menu. Closes on outside click or Escape. */
export function ActionsMenu({ label, actions, align = 'right' }: { label: string; actions: MenuAction[]; align?: 'right' | 'left' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!actions.length) return null
  return (
    <div ref={ref} className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-ink-700 transition hover:border-ink-800/40 ${panelFocus}`}
      >
        <PanelIcon name="more" className="h-5 w-5" />
      </button>
      {open ? (
        <div role="menu" className={`absolute z-40 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                action.onSelect()
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-[#f6f3ee] ${action.danger ? 'font-semibold text-red-700' : 'text-ink-950'}`}
            >
              {action.label}
              {action.hint ? <span className="mt-0.5 block text-xs font-normal text-ink-600">{action.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Centered dialog (bottom sheet on phones). */
export function PanelDialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`max-h-[92svh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6 ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <h2 className="font-display text-xl font-bold text-ink-950">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

export function PanelSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`min-h-11 rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-ink-950 transition hover:border-ink-800/40 ${panelFocus}`}
      >
        {children}
      </select>
    </label>
  )
}
