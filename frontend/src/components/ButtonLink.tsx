import type { PropsWithChildren } from 'react'
import { Link } from 'react-router-dom'

interface ButtonLinkProps extends PropsWithChildren {
  to: string
  variant?: 'primary' | 'secondary'
}

export function ButtonLink({ to, variant = 'primary', children }: ButtonLinkProps) {
  const variants = {
    primary: 'bg-ink-950 text-white hover:bg-ink-800 shadow-lg shadow-slate-900/15',
    secondary: 'border border-slate-300 bg-white text-ink-950 hover:border-gold-500 hover:text-ink-950',
  }

  return (
    <Link
      to={to}
      className={`inline-flex min-h-12 items-center justify-center rounded-lg px-6 text-sm font-black transition ${variants[variant]}`}
    >
      {children}
    </Link>
  )
}
