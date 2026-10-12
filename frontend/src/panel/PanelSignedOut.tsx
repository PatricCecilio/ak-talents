import { Link, useLocation } from 'react-router-dom'
import { RECRUITER_LOGIN_PATH, STAFF_LOGIN_PATH } from '../services/loginDoors'
import { panelButton } from './panelStyles'

// /painel without a session: the person picks their door, so the admin never lands on the recruiters' login.
// Both doors come back to the page that was asked for.
export function PanelSignedOut() {
  const from = useLocation().pathname
  return (
    <div className="grid min-h-svh place-items-center bg-[#f6f3ee] px-4 py-10">
      <meta name="robots" content="noindex, nofollow" />
      <main className="grid w-full max-w-sm gap-6 rounded-2xl border border-[#e7e1d6] bg-white p-6 text-center shadow-sm">
        <div className="flex items-center justify-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-gold-400 font-display text-sm font-extrabold text-ink-950">AK</span>
          <span className="font-display text-xl font-bold text-ink-950">AK Talent</span>
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink-950">Painel da equipe</h1>
          <p className="mt-1 text-sm text-ink-600">Entre pelo seu acesso para continuar.</p>
        </div>
        <div className="grid gap-3">
          <Link to={STAFF_LOGIN_PATH} state={{ from }} className={panelButton.navy}>
            Sou da administração
          </Link>
          <Link to={RECRUITER_LOGIN_PATH} state={{ from }} className={panelButton.outline}>
            Sou recrutadora
          </Link>
        </div>
        <Link to="/" className="text-sm font-semibold text-ink-600 hover:text-ink-950">
          Voltar para o site
        </Link>
      </main>
    </div>
  )
}
