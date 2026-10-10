interface AiComingSoonProps {
  eyebrow: string
  title: string
  description: string
  className?: string
}

// Shown instead of an AI feature while the assistant is not configured: visible, but nothing to click.
export function AiComingSoon({ eyebrow, title, description, className = '' }: AiComingSoonProps) {
  return (
    <div aria-disabled="true" className={`rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-left ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-ink-400">{eyebrow}</p>
        <span className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-black uppercase tracking-[0.12em] text-ink-600">
          Em breve
        </span>
      </div>
      <h2 className="mt-2 text-xl font-black text-ink-600">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-600">{description}</p>
    </div>
  )
}
