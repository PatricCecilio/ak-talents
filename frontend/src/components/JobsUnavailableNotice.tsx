import { resolveWhatsappConfig } from '../services/whatsapp'

interface JobsUnavailableNoticeProps {
  title?: string
  description?: string
}

// Shown instead of job cards when there are no open jobs (or the jobs API is unreachable) in
// production. WhatsApp is only a fallback contact here; the link appears once VITE_WHATSAPP_URL is set.
export function JobsUnavailableNotice({
  title = 'Novas vagas em breve',
  description = 'Estamos preparando novas oportunidades. Volte em alguns dias para conferir.',
}: JobsUnavailableNoticeProps) {
  const whatsapp = resolveWhatsappConfig()

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center sm:px-10">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gold-50 text-gold-700">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" />
          <path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
          <path d="M4 12h16" />
        </svg>
      </span>
      <h3 className="mt-4 font-display text-xl font-bold text-ink-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-base leading-7 text-ink-600">{description}</p>
      {whatsapp.url ? (
        <a
          href={whatsapp.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg border border-ink-950/15 bg-white px-6 text-[15px] font-semibold text-ink-950 shadow-sm transition hover:border-gold-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600"
        >
          {whatsapp.label}
        </a>
      ) : null}
    </div>
  )
}
