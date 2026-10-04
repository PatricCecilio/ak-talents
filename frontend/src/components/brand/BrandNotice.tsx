import type { PropsWithChildren } from 'react'

const tones = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-slate-200 bg-slate-50 text-ink-700',
  warning: 'border-gold-100 bg-gold-50 text-gold-800',
} as const

interface BrandNoticeProps extends PropsWithChildren {
  tone?: keyof typeof tones
  className?: string
}

export function BrandNotice({ tone = 'info', className = '', children }: BrandNoticeProps) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm leading-6 ${tones[tone]} ${className}`}>
      {children}
    </div>
  )
}
