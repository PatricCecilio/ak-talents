// Class strings shared by the new panel screens.

export const panelFocus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600'
export const panelButton = {
  navy: `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink-950 px-4 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:opacity-60 ${panelFocus}`,
  outline: `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-ink-950 transition hover:border-ink-800/40 disabled:opacity-60 ${panelFocus}`,
  link: `inline-flex items-center gap-1 text-sm font-semibold text-gold-800 transition hover:text-ink-950 ${panelFocus}`,
}
