/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_APPINTELLI_WIDGET_URL?: string
  readonly VITE_APPINTELLI_WIDGET_KEY?: string
  readonly VITE_WHATSAPP_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
