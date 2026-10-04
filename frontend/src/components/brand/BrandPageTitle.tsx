import type { ReactNode } from 'react'
import { brandEyebrow, brandHeading } from './styles'

interface BrandPageTitleProps {
  eyebrow?: string
  title: string
  description?: ReactNode
  action?: ReactNode
}

export function BrandPageTitle({ eyebrow, title, description, action }: BrandPageTitleProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className={brandEyebrow}>{eyebrow}</p> : null}
        <h1 className={`mt-2 text-2xl leading-tight sm:text-3xl ${brandHeading}`}>{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-base leading-7 text-ink-600">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
