import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
      <div className="max-w-3xl">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-500">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-black leading-tight text-ink-950 sm:text-4xl">{title}</h1>
        {description ? <p className="mt-4 text-base leading-7 text-ink-600">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
