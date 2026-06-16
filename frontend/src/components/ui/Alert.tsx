import type { PropsWithChildren } from 'react'

interface AlertProps extends PropsWithChildren {
  tone?: 'success' | 'error' | 'info'
}

const tones = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
}

export function Alert({ children, tone = 'info' }: AlertProps) {
  return <div className={`rounded-lg border p-4 text-sm font-semibold ${tones[tone]}`}>{children}</div>
}
