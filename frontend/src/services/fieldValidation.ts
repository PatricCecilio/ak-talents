// Field validation in Portuguese, shown inside each field (forms use noValidate, so the browser's own English
// bubbles never appear). Same rules as the API. Pure functions, no runtime imports: the tests load this file directly.

export const FIELD_MESSAGES = {
  required: 'Preencha este campo.',
  email: 'Informe um e-mail válido, como nome@exemplo.com.',
  url: 'Informe um link válido, começando com https://',
  number: 'Informe só números.',
  fullName: 'Informe seu nome completo.',
  phone: 'Informe seu telefone ou WhatsApp, com DDD.',
  phoneInvalid: 'Confira o telefone: informe o DDD e o número.',
  city: 'Informe sua cidade.',
  linkedin: 'Confira o link do LinkedIn. Exemplo: https://linkedin.com/in/seu-perfil',
  portfolio: 'Confira o link do portfólio. Exemplo: https://seusite.com.br',
  resume: 'Confira o link do currículo. Exemplo: um link do Google Drive ou do Dropbox.',
  negative: 'Informe um valor igual ou maior que zero.',
} as const

const phoneDigits = (value: string) => value.replace(/\D+/g, '').length

/** "" -> "" (optional, ok); "linkedin.com/in/ana" -> "https://linkedin.com/in/ana"; null when it is not a link. */
export function normalizeOptionalUrl(value: string): string | null {
  let text = value.trim()
  if (!text) return ''
  if (!text.includes('://')) text = `https://${text}`
  if (/\s/.test(text)) return null
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  const host = url.hostname
  if (!['http:', 'https:'].includes(url.protocol) || !host.includes('.') || host.startsWith('.') || host.endsWith('.')) return null
  return text
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

// --- "Meu perfil" (/candidate) ----------------------------------------------------------------------------------------

// A type (not an interface) so it fits useFormState's Record<string, string>.
export type CandidateProfileFormValues = {
  full_name: string
  phone: string
  city: string
  state: string
  desired_role: string
  professional_summary: string
  skills: string
  experience_years: string
  salary_expectation: string
  work_mode: string
  linkedin_url: string
  portfolio_url: string
  resume_url: string
}

export type CandidateProfileErrors = Partial<Record<keyof CandidateProfileFormValues, string>>

/** Only name, phone/WhatsApp and city are required (the e-mail is the account's). Links checked only when filled in. */
export function validateCandidateProfile(values: CandidateProfileFormValues): CandidateProfileErrors {
  const errors: CandidateProfileErrors = {}
  if (values.full_name.trim().length < 2) errors.full_name = FIELD_MESSAGES.fullName
  if (!values.phone.trim()) errors.phone = FIELD_MESSAGES.phone
  else if (phoneDigits(values.phone) < 8 || phoneDigits(values.phone) > 15) errors.phone = FIELD_MESSAGES.phoneInvalid
  if (!values.city.trim()) errors.city = FIELD_MESSAGES.city
  for (const field of ['experience_years', 'salary_expectation'] as const) {
    const text = values[field].trim().replace(',', '.')
    if (!text) continue
    const number = Number(text)
    if (!Number.isFinite(number)) errors[field] = FIELD_MESSAGES.number
    else if (number < 0) errors[field] = FIELD_MESSAGES.negative
  }
  if (normalizeOptionalUrl(values.linkedin_url) === null) errors.linkedin_url = FIELD_MESSAGES.linkedin
  if (normalizeOptionalUrl(values.portfolio_url) === null) errors.portfolio_url = FIELD_MESSAGES.portfolio
  if (normalizeOptionalUrl(values.resume_url) === null) errors.resume_url = FIELD_MESSAGES.resume
  return errors
}

const optionalNumber = (value: string): number | null => {
  const text = value.trim().replace(',', '.')
  return text ? Number(text) : null
}

const blankToNull = (value: string): string | null => value.trim() || null

/** Payload for PUT /candidates/me (call after validateCandidateProfile returned no errors). */
export function toCandidateProfilePayload(values: CandidateProfileFormValues) {
  return {
    full_name: values.full_name.trim(),
    phone: values.phone.trim(),
    city: values.city.trim(),
    state: blankToNull(values.state),
    desired_role: blankToNull(values.desired_role),
    professional_summary: blankToNull(values.professional_summary),
    skills: blankToNull(values.skills),
    experience_years: optionalNumber(values.experience_years),
    salary_expectation: optionalNumber(values.salary_expectation),
    work_mode: blankToNull(values.work_mode),
    linkedin_url: normalizeOptionalUrl(values.linkedin_url) || null,
    portfolio_url: normalizeOptionalUrl(values.portfolio_url) || null,
    resume_url: normalizeOptionalUrl(values.resume_url) || null,
  }
}

// --- Native validity (any other form that still uses required/type) ------------------------------------------------

interface ValidityLike {
  valueMissing?: boolean
  typeMismatch?: boolean
  badInput?: boolean
  rangeUnderflow?: boolean
  rangeOverflow?: boolean
  tooShort?: boolean
  tooLong?: boolean
  stepMismatch?: boolean
}

/** Portuguese text for the browser's validity state, used with setCustomValidity on inputs without noValidate. */
export function nativeValidityMessage(validity: ValidityLike, type = 'text', min?: string, max?: string, minLength?: number): string {
  if (validity.valueMissing) return type === 'checkbox' ? 'Marque esta opção para continuar.' : FIELD_MESSAGES.required
  if (validity.typeMismatch) return type === 'email' ? FIELD_MESSAGES.email : type === 'url' ? FIELD_MESSAGES.url : 'Confira este campo.'
  if (validity.badInput) return FIELD_MESSAGES.number
  if (validity.rangeUnderflow) return `Informe um valor igual ou maior que ${min}.`
  if (validity.rangeOverflow) return `Informe um valor igual ou menor que ${max}.`
  if (validity.tooShort) return `Use pelo menos ${minLength} caracteres.`
  if (validity.tooLong) return 'Texto longo demais.'
  if (validity.stepMismatch) return 'Informe um número inteiro.'
  return ''
}
