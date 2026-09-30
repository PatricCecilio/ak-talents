import type { PublicApplicationPayload } from '../types/user'

export interface PublicApplicationFormValues {
  full_name: string
  email: string
  phone: string
  city: string
  neighborhood: string
  privacy_accepted: boolean
}

export interface PublicApplicationValidation {
  isValid: boolean
  message: string
}

export function validatePublicApplicationForm(values: PublicApplicationFormValues): PublicApplicationValidation {
  if (!values.full_name.trim()) return { isValid: false, message: 'Informe seu nome completo.' }
  if (!values.email.trim()) return { isValid: false, message: 'Informe seu e-mail.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    return { isValid: false, message: 'Informe um e-mail valido.' }
  }
  if (!values.phone.trim()) return { isValid: false, message: 'Informe seu telefone.' }
  if (values.phone.replace(/\D+/g, '').length < 8) {
    return { isValid: false, message: 'Informe um telefone valido.' }
  }
  if (!values.city.trim()) return { isValid: false, message: 'Informe sua cidade.' }
  if (!values.neighborhood.trim()) return { isValid: false, message: 'Informe seu bairro.' }
  if (!values.privacy_accepted) {
    return { isValid: false, message: 'Aceite o tratamento dos dados para enviar sua candidatura.' }
  }

  return { isValid: true, message: '' }
}

export function toPublicApplicationPayload(values: PublicApplicationFormValues): PublicApplicationPayload {
  return {
    full_name: values.full_name.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    city: values.city.trim(),
    neighborhood: values.neighborhood.trim(),
    privacy_accepted: values.privacy_accepted,
  }
}
