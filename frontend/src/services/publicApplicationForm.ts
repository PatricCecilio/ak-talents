import type { PublicApplicationPayload } from '../types/user'

export interface PublicApplicationFormValues {
  full_name: string
  email: string
  phone: string
  city: string
  neighborhood: string
  privacy_accepted: boolean
}

export type PublicApplicationField = Exclude<keyof PublicApplicationFormValues, 'neighborhood'>

export interface PublicApplicationValidation {
  isValid: boolean
  /** First problem (kept for callers that show a single message). */
  message: string
  /** One message per field, shown under each field (same order as on screen). */
  fieldErrors: Partial<Record<PublicApplicationField, string>>
}

// Only the essentials are required: name, e-mail, phone/WhatsApp and city (+ the privacy consent).
export function validatePublicApplicationForm(values: PublicApplicationFormValues): PublicApplicationValidation {
  const fieldErrors: Partial<Record<PublicApplicationField, string>> = {}
  if (!values.full_name.trim()) fieldErrors.full_name = 'Informe seu nome completo.'
  if (!values.email.trim()) fieldErrors.email = 'Informe seu e-mail.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) fieldErrors.email = 'Informe um e-mail válido.'
  if (!values.phone.trim()) fieldErrors.phone = 'Informe seu telefone.'
  else if (values.phone.replace(/\D+/g, '').length < 8) fieldErrors.phone = 'Informe um telefone válido, com DDD.'
  if (!values.city.trim()) fieldErrors.city = 'Informe sua cidade.'
  if (!values.privacy_accepted) fieldErrors.privacy_accepted = 'Aceite o tratamento dos dados para enviar sua candidatura.'

  const message = Object.values(fieldErrors)[0] ?? ''
  return { isValid: !message, message, fieldErrors }
}

export function toPublicApplicationPayload(values: PublicApplicationFormValues): PublicApplicationPayload {
  return {
    full_name: values.full_name.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    city: values.city.trim(),
    neighborhood: values.neighborhood.trim() || undefined,
    privacy_accepted: values.privacy_accepted,
  }
}
