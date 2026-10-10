import type { PropsWithChildren } from 'react'

interface CardProps extends PropsWithChildren {
  className?: string
  id?: string
}

export function Card({ children, className = '', id }: CardProps) {
  return (
    <div id={id} className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  )
}
