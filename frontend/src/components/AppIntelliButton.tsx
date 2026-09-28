import { appIntelliCtas, openAppIntelli, type AppIntelliCtaId } from '../services/appIntelliWidget'

interface AppIntelliButtonProps {
  cta: AppIntelliCtaId
  className?: string
}

export function AppIntelliButton({ cta, className = '' }: AppIntelliButtonProps) {
  const config = appIntelliCtas[cta]

  return (
    <button
      type="button"
      data-appintelli-cta={cta}
      className={`cursor-pointer ${className}`}
      onClick={() => openAppIntelli(config)}
    >
      {config.ctaLabel}
    </button>
  )
}
