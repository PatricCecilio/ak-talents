// Client companies no longer use the system: AK operates everything and sends the results by WhatsApp. The company
// portal (sign-up, login, /company) stays in the code behind this flag, off unless VITE_COMPANY_PORTAL_ENABLED="true".
// Mirrors COMPANY_PORTAL_ENABLED in the API. No runtime imports: the tests load this file directly.

export function isCompanyPortalEnabled(env: ImportMetaEnv = import.meta.env): boolean {
  return env.VITE_COMPANY_PORTAL_ENABLED?.trim() === 'true'
}

/** Same text the API sends when a company account tries to sign in. */
export const COMPANY_PORTAL_CLOSED_MESSAGE =
  'O acesso de empresas foi encerrado. Agora a AK Talent cuida de todo o processo e envia os resultados pelo WhatsApp.'

/** Where closed company paths (/entrar/empresa, /company) send people: the chooser, with the notice. */
export const COMPANY_CLOSED_PATH = '/entrar?erro=empresa'
