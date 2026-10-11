export interface WhatsappConfig {
  url: string
  label: string
}

/** WhatsApp contact link from VITE_WHATSAPP_URL (e.g. https://wa.me/5541999999999). Empty when unset or not https. */
export function resolveWhatsappConfig(env: ImportMetaEnv = import.meta.env): WhatsappConfig {
  const url = env.VITE_WHATSAPP_URL?.trim() || ''
  return {
    url: url.startsWith('https://') ? url : '',
    label: 'Chamar a AK Talent no WhatsApp',
  }
}

export const HIRE_EMAIL = 'contato@aktalent.com.br'
const HIRE_MESSAGE = 'Olá! Quero contratar com a AK Talent.'

export interface HireContact {
  href: string
  /** "WhatsApp" when VITE_WHATSAPP_URL is set; otherwise the e-mail fallback. */
  channel: 'whatsapp' | 'email'
}

/** "Quero contratar": the commercial WhatsApp (with a ready message) or, while it is not configured, an e-mail. */
export function hireContact(env: ImportMetaEnv = import.meta.env): HireContact {
  const { url } = resolveWhatsappConfig(env)
  if (url) {
    const separator = url.includes('?') ? '&' : '?'
    return { href: `${url}${separator}text=${encodeURIComponent(HIRE_MESSAGE)}`, channel: 'whatsapp' }
  }
  return { href: `mailto:${HIRE_EMAIL}?subject=${encodeURIComponent('Quero contratar')}`, channel: 'email' }
}
