import type { PropsWithChildren } from 'react'

interface BadgeProps extends PropsWithChildren {
  status?: 'pending' | 'approved' | 'blocked' | 'hidden' | 'default'
  className?: string
}

const variants = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  blocked: 'border-red-200 bg-red-50 text-red-700',
  hidden: 'border-slate-300 bg-slate-100 text-slate-700',
  default: 'border-slate-200 bg-slate-50 text-ink-600',
}

export function Badge({ children, status = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-lg border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${variants[status]} ${className}`}>
      {children}
    </span>
  )
}
