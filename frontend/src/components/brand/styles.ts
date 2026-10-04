// Shared class strings for the new (landing-style) screens: navy, bronze, white and light gray,
// Plus Jakarta Sans headings, soft borders. Old dashboards keep components/ui.

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600'

const buttonBase = `inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-center text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`

export const brandButtonVariants = {
  primary: `${buttonBase} bg-gold-700 text-white shadow-md shadow-gold-700/20 hover:bg-gold-800`,
  navy: `${buttonBase} bg-ink-950 text-white hover:bg-ink-800`,
  secondary: `${buttonBase} border border-ink-950/15 bg-white text-ink-950 hover:border-ink-800/40`,
  danger: `${buttonBase} border border-red-200 bg-white text-red-700 hover:border-red-400 hover:bg-red-50`,
  ghost: `${buttonBase} min-h-10 px-3 text-ink-700 hover:bg-slate-100`,
} as const

export type BrandButtonVariant = keyof typeof brandButtonVariants

export const brandCard = 'rounded-xl border border-slate-200 bg-white'

export const brandLabel = 'grid gap-1.5 text-sm font-semibold text-ink-800'

export const brandInput =
  'min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-gold-600 focus:ring-4 focus:ring-gold-100'

export const brandEyebrow = 'text-xs font-semibold uppercase tracking-[0.16em] text-gold-800'

export const brandHeading = 'font-display font-bold tracking-[-0.02em] text-ink-950'
