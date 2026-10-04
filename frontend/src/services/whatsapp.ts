export interface WhatsappConfig {
  url: string
  label: string
}

export function resolveWhatsappConfig(env: ImportMetaEnv = import.meta.env): WhatsappConfig {
  return {
    url: env.VITE_WHATSAPP_URL?.trim() || '',
    label: 'Falar com um especialista pelo WhatsApp',
  }
}
