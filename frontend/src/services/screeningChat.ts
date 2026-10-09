// The AppIntelli chat as an optional way to answer the screening questions. Off by default: turn it on
// (VITE_APPINTELLI_SCREENING_ENABLED="true") only after the AppIntelli side is confirmed to call our
// integration endpoints (see DEPLOY.md, "Chat de triagem do AppIntelli").
export function isScreeningChatEnabled(env: ImportMetaEnv = import.meta.env): boolean {
  return env.VITE_APPINTELLI_SCREENING_ENABLED?.trim().toLowerCase() === 'true'
}

export const SCREENING_CHAT_UNAVAILABLE_MESSAGE = 'O chat não está disponível agora. Responda as perguntas acima.'
