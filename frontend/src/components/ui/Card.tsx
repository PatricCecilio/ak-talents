import type { PropsWithChildren } from 'react'

interface CardProps extends PropsWithChildren {
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return <div className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>
}
