import { Link } from 'react-router-dom'

interface LoadErrorStateProps {
  title: string
  description: string
  onRetry?: () => void
  secondaryAction?: { to: string; label: string }
}

// Friendly full-width error state for public pages: plain language and large tap targets,
// thought for people on a phone who rarely use technology.
export function LoadErrorState({ title, description, onRetry, secondaryAction }: LoadErrorStateProps) {
  return (
    <div role="alert" className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center sm:px-10">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-ink-700">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <path d="M12 8v5" />
          <path d="M12 16.5h.01" />
        </svg>
      </span>
      <h2 className="mt-4 font-display text-xl font-bold text-ink-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-base leading-7 text-ink-600">{description}</p>
      <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-ink-950 px-6 text-base font-semibold text-white transition hover:bg-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600"
          >
            Tentar novamente
          </button>
        ) : null}
        {secondaryAction ? (
          <Link
            to={secondaryAction.to}
            className="inline-flex min-h-12 items-center justify-center rounded-lg border border-ink-950/15 bg-white px-6 text-base font-semibold text-ink-950 transition hover:border-gold-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600"
          >
            {secondaryAction.label}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
