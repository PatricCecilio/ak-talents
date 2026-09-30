// Public API exposed by the AppIntelli widget loader (https://www.appintelli.com.br/widget.js).
// The entry context is only an unconfirmed hint about which CTA opened the chat: it never sends a
// message, never creates a conversation and never fills visitor data.
export interface AppIntelliEntryContext {
  intentHint?: string
  entryPoint?: string
  pageSection?: string
  journeyStage?: string
  metadata?: {
    ctaLabel?: string
    applicationReference?: string
  }
}

export interface AppIntelliOpenOptions {
  context?: AppIntelliEntryContext
}

export interface AppIntelliApi {
  open: (options?: AppIntelliOpenOptions) => void
  close: () => void
}

declare global {
  interface Window {
    AppIntelli?: AppIntelliApi
  }
}
