interface LoadingSpinnerProps {
  label?: string
}

export function LoadingSpinner({ label = 'Carregando...' }: LoadingSpinnerProps) {
  return (
    <div className="inline-flex items-center gap-3 text-sm font-semibold text-ink-600">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-700 border-t-transparent" />
      {label}
    </div>
  )
}
