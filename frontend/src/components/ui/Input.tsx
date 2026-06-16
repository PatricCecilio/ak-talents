import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, id, className = '', ...props }: InputProps) {
  const input = (
    <input
      id={id}
      className={`h-12 rounded-lg border border-slate-300 bg-white px-4 text-base font-medium text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-gold-500 focus:ring-4 focus:ring-amber-100 ${className}`}
      {...props}
    />
  )

  if (!label) {
    return input
  }

  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-bold text-ink-800">
      {label}
      {input}
    </label>
  )
}
