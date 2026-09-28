import { Link } from 'react-router-dom'

export function Logo() {
  return (
    <Link to="/" className="inline-flex items-center gap-3.5" aria-label="AK Talent">
      <span className="grid h-12 w-12 place-items-center rounded-lg bg-ink-950 text-base font-black text-gold-400 shadow-sm">
        AK
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-lg font-black tracking-[0.08em] text-ink-950">AK</span>
        <span className="text-[13px] font-bold uppercase tracking-[0.2em] text-gold-500">Talent</span>
      </span>
    </Link>
  )
}
