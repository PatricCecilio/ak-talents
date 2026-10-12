import type { FormEvent } from 'react'
import { nativeValidityMessage } from '../../services/fieldValidation'

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

/** Forms that still rely on required/type get the browser's message in Portuguese instead of English. */
export function portugueseValidity(event: FormEvent<FieldElement>) {
  const field = event.currentTarget
  field.setCustomValidity('')
  if (field.validity.valid) return
  const input = field instanceof HTMLInputElement ? field : null
  field.setCustomValidity(
    nativeValidityMessage(field.validity, input?.type ?? 'text', input?.min, input?.max, input?.minLength ?? undefined),
  )
}

/** The message must be recomputed after each change, so the custom one is cleared while typing. */
export function clearValidity(event: FormEvent<FieldElement>) {
  event.currentTarget.setCustomValidity('')
}

// Border/focus colours of a field: normal or with an error (never both, or the grey border would win).
export const fieldBorderClass = 'border-slate-300 focus:border-gold-500 focus:ring-amber-100'
export const fieldErrorClass = 'border-red-400 focus:border-red-500 focus:ring-red-100'
