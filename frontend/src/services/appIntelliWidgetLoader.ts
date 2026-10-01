export const DEFAULT_APPINTELLI_WIDGET_URL = 'https://www.appintelli.com.br/widget.js'

export interface AppIntelliWidgetConfig {
  url: string
  key: string
}

export function resolveAppIntelliWidgetConfig(env: ImportMetaEnv = import.meta.env): AppIntelliWidgetConfig {
  return {
    url: env.VITE_APPINTELLI_WIDGET_URL || DEFAULT_APPINTELLI_WIDGET_URL,
    key: env.VITE_APPINTELLI_WIDGET_KEY || '',
  }
}

export function installAppIntelliWidget(
  env: ImportMetaEnv = import.meta.env,
  documentRef: Document = document,
): HTMLScriptElement {
  const config = resolveAppIntelliWidgetConfig(env)
  const script = documentRef.createElement('script')
  script.src = config.url
  script.async = true
  if (config.key) {
    script.dataset.widgetKey = config.key
  }
  documentRef.body.appendChild(script)
  return script
}
