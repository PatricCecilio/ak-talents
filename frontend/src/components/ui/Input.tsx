import type { InputHTMLAttributes } from 'react'
import { FieldError } from './FieldError'
import { clearValidity, fieldBorderClass, fieldErrorClass, portugueseValidity } from './fieldHelpers'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  /** Shown under the field, in Portuguese. */
  error?: string
}

export function Input({ label, id, className = '', error, onInvalid, onInput, ...props }: InputProps) {
  const errorId = id ? `${id}-error` : undefined
  const input = (
    <input
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
      className={`h-12 w-full min-w-0 rounded-lg border bg-white px-4 text-base font-medium text-ink-950 outline-none transition placeholder:text-ink-400 focus:ring-4 ${error ? fieldErrorClass : fieldBorderClass} ${className}`}
      {...props}
    />
  )

  if (!label) {
    return error ? (
      <span className="grid gap-1">
        {input}
        <FieldError id={errorId ?? ''} message={error} />
      </span>
    ) : (
      input
    )
  }

  return (
    <label htmlFor={id} className="grid content-start gap-2 text-sm font-bold text-ink-800">
      {label}
      {input}
      <FieldError id={errorId ?? ''} message={error} />
    </label>
  )
}
