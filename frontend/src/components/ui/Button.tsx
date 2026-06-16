import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, PropsWithChildren {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark'
  isLoading?: boolean
}

const variants = {
  primary: 'bg-brand-700 text-white shadow-lg shadow-slate-900/10 hover:bg-brand-600',
  secondary: 'border border-slate-300 bg-white text-ink-800 hover:border-gold-500 hover:text-ink-950',
  ghost: 'bg-transparent text-ink-600 hover:bg-slate-100 hover:text-ink-950',
  danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  dark: 'bg-ink-950 text-white shadow-lg shadow-slate-900/10 hover:bg-ink-800',
}

export function Button({ children, variant = 'primary', isLoading = false, className = '', disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-70 ${variants[variant]} ${className}`}
    >
      {isLoading ? (
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  )
}
