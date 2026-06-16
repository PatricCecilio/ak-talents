import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export function Select({ label, id, className = '', children, ...props }: SelectProps) {
  const select = (
    <select
      id={id}
      className={`h-12 rounded-lg border border-slate-300 bg-white px-4 text-base font-medium text-ink-950 outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-amber-100 ${className}`}
      {...props}
    >
      {children}
    </select>
  )

  if (!label) {
    return select
  }

  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-bold text-ink-800">
      {label}
      {select}
    </label>
  )
}
