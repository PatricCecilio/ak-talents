import type { TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function Textarea({ label, id, className = '', ...props }: TextareaProps) {
  const textarea = (
    <textarea
      id={id}
      className={`rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-medium text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-gold-500 focus:ring-4 focus:ring-amber-100 ${className}`}
      {...props}
    />
  )

  if (!label) {
    return textarea
  }

  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-bold text-ink-800">
      {label}
      {textarea}
    </label>
  )
}
