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
