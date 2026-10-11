import { hireContact } from '../services/whatsapp'

interface HireContactLinkProps {
  /** card: big choice on /entrar; button: compact, inside notices and forms. */
  variant?: 'card' | 'button'
}

const WHATSAPP_ICON = (
  <path d="M20 12a8 8 0 0 1-11.9 7l-4.1 1 1.1-3.9A8 8 0 1 1 20 12Zm-11-3.5c.2 1.6 1 3 2.2 4.2 1.2 1.2 2.7 2 4.3 2.3l1-1.2-1.8-.9-.8.8a5 5 0 0 1-2.9-2.9l.8-.8-.9-1.8-1.9 1.1Z" />
)

// "Quero contratar": companies talk to AK (WhatsApp, or e-mail while the number is not configured).
export function HireContactLink({ variant = 'button' }: HireContactLinkProps) {
  const contact = hireContact()
  const channel = contact.channel === 'whatsapp' ? 'Fale com a AK Talent no WhatsApp.' : 'Fale com a AK Talent por e-mail.'

  if (variant === 'card') {
    return (
      <a
        href={contact.href}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex min-h-28 items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gold-50 text-gold-700">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {WHATSAPP_ICON}
          </svg>
        </span>
        <span>
          <span className="block text-xl font-black text-ink-950">Quero contratar</span>
          <span className="mt-1 block text-sm leading-6 text-ink-600">{channel}</span>
        </span>
      </a>
    )
  }

  return (
    <a
      href={contact.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-ink-950 transition hover:border-gold-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-gold-700" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {WHATSAPP_ICON}
      </svg>
      Quero contratar
    </a>
  )
}
