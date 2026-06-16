interface EmptyStateProps {
  title: string
  description?: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="text-sm font-black text-ink-800">{title}</p>
      {description ? <p className="mt-2 text-sm leading-6 text-ink-600">{description}</p> : null}
    </div>
  )
}
