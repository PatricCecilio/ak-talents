import { useState } from 'react'
import { useLocation } from 'react-router-dom'

// Shown once on the panel when someone signed in through the other audience's login (e.g. a company account at
// /entrar/candidato). Comes from navigation state, so it disappears on the next navigation or reload.
export function LoginNotice() {
  const location = useLocation()
  const [dismissedAt, setDismissedAt] = useState<string | null>(null)
  const state = location.state as { loginNotice?: unknown } | null
  const notice = typeof state?.loginNotice === 'string' ? state.loginNotice : ''

  if (!notice || dismissedAt === location.key) return null

  return (
    <div role="status" className="mb-4 flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
      <p className="flex-1">{notice}</p>
      <button
        type="button"
        onClick={() => setDismissedAt(location.key)}
        aria-label="Fechar aviso"
        className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-sky-800 hover:bg-sky-100"
      >
        ×
      </button>
    </div>
  )
}
