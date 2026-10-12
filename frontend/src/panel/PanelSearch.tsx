import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchPanel } from './panelApi'
import { PANEL_BASE } from './panelFormat'
import { PanelIcon } from './PanelUi'
import { panelFocus } from './panelStyles'
import type { SearchHit, SearchResponse } from './types'

const GROUPS: Array<{ key: keyof SearchResponse; title: string; to: (hit: SearchHit) => string }> = [
  { key: 'candidates', title: 'Candidatos', to: (hit) => `${PANEL_BASE}/candidatos/${hit.id}` },
  { key: 'jobs', title: 'Vagas', to: (hit) => `${PANEL_BASE}/vagas/${hit.id}` },
  { key: 'companies', title: 'Empresas', to: () => `${PANEL_BASE}/empresas` },
]

// "Buscar candidato, vaga ou empresa..." in the top bar: results grouped, after 2 letters.
export function PanelSearch() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  const term = text.trim()
  // Short terms show nothing (the last results are simply not displayed).
  const shown = term.length >= 2 ? results : null

  useEffect(() => {
    if (term.length < 2) return
    let active = true
    const timer = window.setTimeout(() => {
      searchPanel(term)
        .then((response) => active && setResults(response))
        .catch(() => active && setResults({ candidates: [], jobs: [], companies: [] }))
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [term])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const empty = shown && !shown.candidates.length && !shown.jobs.length && !shown.companies.length

  return (
    <div ref={box} className="relative">
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#e7e1d6] bg-[#f6f3ee] px-3 focus-within:border-gold-600">
        <PanelIcon name="search" className="h-4 w-4 shrink-0 text-ink-400" />
        <span className="sr-only">Buscar</span>
        <input
          type="search"
          value={text}
          placeholder="Buscar candidato, vaga ou empresa..."
          onChange={(event) => {
            setText(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink-950 outline-none placeholder:text-ink-400"
        />
      </label>
      {open && shown ? (
        <div className="absolute left-0 right-0 z-40 mt-1 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          {empty ? <p className="px-3 py-2 text-sm text-ink-600">Nada encontrado para “{term}”.</p> : null}
          {GROUPS.map((group) =>
            shown[group.key].length ? (
              <div key={group.key} className="py-1">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">{group.title}</p>
                {shown[group.key].map((hit) => (
                  <button
                    key={`${hit.kind}-${hit.id}`}
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      setText('')
                      navigate(group.to(hit))
                    }}
                    className={`block w-full rounded-lg px-3 py-2 text-left transition hover:bg-[#f6f3ee] ${panelFocus}`}
                  >
                    <span className="block text-sm font-semibold text-ink-950">{hit.title}</span>
                    {hit.detail ? <span className="block text-xs text-ink-600">{hit.detail}</span> : null}
                  </button>
                ))}
              </div>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  )
}
