/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPINTELLI_WIDGET_URL?: string
  readonly VITE_APPINTELLI_WIDGET_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
