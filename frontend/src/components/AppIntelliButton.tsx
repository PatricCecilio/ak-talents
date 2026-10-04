import { useState, type ReactNode } from 'react'
import { appIntelliCtas, openAppIntelli, type AppIntelliCtaId } from '../services/appIntelliWidget'

interface AppIntelliButtonProps {
  cta: AppIntelliCtaId
  className?: string
  /** Optional decoration rendered around the label (icons); the label itself stays the CTA config text. */
  leading?: ReactNode
  trailing?: ReactNode
  labelClassName?: string
}

export function AppIntelliButton({ cta, className = '', leading, trailing, labelClassName }: AppIntelliButtonProps) {
  const config = appIntelliCtas[cta]
  const [status, setStatus] = useState('')

  function handleClick() {
    const result = openAppIntelli(config)
    setStatus(result === 'unavailable' ? 'Chat indisponível no momento.' : '')
  }

  return (
    <span className="inline-flex flex-col gap-2">
      <button type="button" data-appintelli-cta={cta} className={`cursor-pointer ${className}`} onClick={handleClick}>
        {leading}
        <span className={labelClassName}>{config.ctaLabel}</span>
        {trailing}
      </button>
      {status ? <span className="text-xs font-bold text-red-700">{status}</span> : null}
    </span>
  )
}
