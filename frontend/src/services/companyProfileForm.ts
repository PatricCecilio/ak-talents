// Company profile form rules. No runtime imports: the tests load this file directly.

export interface CompanyProfileFormValues {
  company_name: string
  responsible_name: string
  phone: string
  city: string
  state: string
  industry: string
  company_size: string
  description: string
  website_url: string
}

export const COMPANY_SIZE_OPTIONS = ['Só eu', '2 a 10', '11 a 50', '51 a 200', 'Mais de 200'] as const

const REQUIRED_FIELDS: Array<[keyof CompanyProfileFormValues, string]> = [
  ['company_name', 'Informe o nome da empresa.'],
  ['responsible_name', 'Informe o nome do responsável.'],
  ['phone', 'Informe o telefone da empresa.'],
  ['city', 'Informe a cidade.'],
  ['state', 'Informe o estado.'],
]

export function validateCompanyProfile(values: CompanyProfileFormValues): { isValid: boolean; message: string } {
  for (const [field, message] of REQUIRED_FIELDS) {
    if (!values[field].trim()) return { isValid: false, message }
  }
  if (values.phone.replace(/\D+/g, '').length < 10) {
    return { isValid: false, message: 'Informe o telefone com DDD.' }
  }
  return { isValid: true, message: '' }
}

/** Sizes offered in the list, plus an older free-text value so it is not lost when editing. */
export function companySizeOptions(current: string): string[] {
  const options: string[] = [...COMPANY_SIZE_OPTIONS]
  return current && !options.includes(current) ? [current, ...options] : options
}

export function toCompanyProfilePayload(values: CompanyProfileFormValues): CompanyProfileFormValues {
  return Object.fromEntries(
    Object.entries(values).map(([field, value]) => [field, value.trim()]),
  ) as unknown as CompanyProfileFormValues
}
