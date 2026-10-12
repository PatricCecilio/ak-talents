import type { SelectHTMLAttributes } from 'react'
import { FieldError } from './FieldError'
import { clearValidity, fieldBorderClass, fieldErrorClass, portugueseValidity } from './fieldHelpers'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  /** Shown under the field, in Portuguese. */
  error?: string
}

export function Select({ label, id, className = '', children, error, onInvalid, onInput, ...props }: SelectProps) {
  const errorId = id ? `${id}-error` : undefined
  const select = (
    <select
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      onInvalid={(event) => {
        portugueseValidity(event)
        onInvalid?.(event)
      }}
      onInput={(event) => {
        clearValidity(event)
        onInput?.(event)
      }}
      className={`h-12 w-full min-w-0 rounded-lg border bg-white px-4 text-base font-medium text-ink-950 outline-none transition focus:ring-4 ${error ? fieldErrorClass : fieldBorderClass} ${className}`}
      {...props}
    >
      {children}
    </select>
  )

  if (!label) {
    return select
  }

  return (
    <label htmlFor={id} className="grid content-start gap-2 text-sm font-bold text-ink-800">
      {label}
      {select}
      <FieldError id={errorId ?? ''} message={error} />
    </label>
  )
}
