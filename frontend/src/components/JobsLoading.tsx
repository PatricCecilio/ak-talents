import { useEffect, useState } from 'react'

export const SLOW_LOADING_AFTER_MS = 3000
export const SLOW_LOADING_MESSAGE = 'A primeira visita do dia pode levar alguns segundos.'

/** "Carregando…" that also explains a slow first load (the API and the database wake up after idle time). */
export function LoadingHint({ label }: { label: string }) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_LOADING_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-1">
      <p className="inline-flex items-center gap-3 text-base font-semibold text-ink-800">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-700 border-t-transparent" aria-hidden="true" />
        {label}
      </p>
      {slow ? <p className="text-sm text-ink-600">{SLOW_LOADING_MESSAGE}</p> : null}
    </div>
  )
}

function SkeletonCard({ tall = false }: { tall?: boolean }) {
  return (
    <div className="animate-pulse rounded-lg border border-slate-200 bg-white p-6 shadow-sm" aria-hidden="true">
      <div className="h-6 w-24 rounded-md bg-slate-200" />
      <div className="mt-4 h-7 w-3/4 rounded-md bg-slate-200" />
      <div className="mt-4 h-4 w-full rounded bg-slate-100" />
      <div className="mt-2 h-4 w-5/6 rounded bg-slate-100" />
      {tall ? <div className="mt-2 h-4 w-2/3 rounded bg-slate-100" /> : null}
      <div className="mt-6 h-12 w-full rounded-lg bg-slate-200 lg:w-32" />
    </div>
  )
}

/** Placeholder with the size of the real job cards, so the page never looks empty while the API answers. */
export function JobsLoading({ label = 'Carregando vagas...', count = 3 }: { label?: string; count?: number }) {
  return (
    <div className="grid gap-4">
      <LoadingHint label={label} />
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} tall={count === 1} />
      ))}
    </div>
  )
}
