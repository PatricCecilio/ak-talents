import type { TextareaHTMLAttributes } from 'react'
import { FieldError } from './FieldError'
import { clearValidity, fieldBorderClass, fieldErrorClass, portugueseValidity } from './fieldHelpers'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  /** Shown under the field, in Portuguese. */
  error?: string
}

export function Textarea({ label, id, className = '', error, onInvalid, onInput, ...props }: TextareaProps) {
  const errorId = id ? `${id}-error` : undefined
  const textarea = (
    <textarea
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
      className={`w-full min-w-0 rounded-lg border bg-white px-4 py-3 text-base font-medium text-ink-950 outline-none transition placeholder:text-ink-400 focus:ring-4 ${error ? fieldErrorClass : fieldBorderClass} ${className}`}
      {...props}
    />
  )

  if (!label) {
    return textarea
  }

  return (
    <label htmlFor={id} className="grid content-start gap-2 text-sm font-bold text-ink-800">
      {label}
      {textarea}
      <FieldError id={errorId ?? ''} message={error} />
    </label>
  )
}
