export const DEFAULT_APPINTELLI_WIDGET_URL = 'https://www.appintelli.com.br/widget.js'
export const APPINTELLI_SCRIPT_ID = 'appintelli-widget-script'

export interface AppIntelliWidgetConfig {
  url: string
  key: string
}

export function resolveAppIntelliWidgetConfig(env: ImportMetaEnv = import.meta.env): AppIntelliWidgetConfig {
  return {
    url: env.VITE_APPINTELLI_WIDGET_URL?.trim() || DEFAULT_APPINTELLI_WIDGET_URL,
    key: env.VITE_APPINTELLI_WIDGET_KEY?.trim() || '',
  }
}

export function installAppIntelliWidget(
  env: ImportMetaEnv = import.meta.env,
  documentRef: Document = document,
): HTMLScriptElement | null {
  const config = resolveAppIntelliWidgetConfig(env)
  const existingScript = documentRef.getElementById?.(APPINTELLI_SCRIPT_ID)
  if (existingScript) {
    return existingScript as HTMLScriptElement
  }

  if (!config.key) {
    console.error('[AK Talent] VITE_APPINTELLI_WIDGET_KEY nao configurada; chat AppIntelli nao pode ser aberto.')
    return null
  }

  const script = documentRef.createElement('script')
  script.id = APPINTELLI_SCRIPT_ID
  script.src = config.url
  script.async = true
  script.dataset.widgetKey = config.key
  documentRef.body.appendChild(script)
  return script
}
