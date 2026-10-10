import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useScrolledPast } from '../hooks/useScrolledPast'
import { getCurrentUser, logout } from '../services/authService'
import { firstName, roleHome } from '../services/roleHome'
import { Container } from './Container'
import { Logo } from './Logo'

const navLinks = [
  { href: '/solucoes/recrutamento', label: 'Soluções' },
  { href: '/#plataforma', label: 'Para empresas' },
  { href: '/vagas', label: 'Vagas' },
  { href: '/#como-funciona', label: 'Como funciona' },
  { href: '/#sobre', label: 'Sobre' },
]

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500'
const outlineButton = `inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-ink-950/15 bg-white px-5 text-sm font-semibold text-ink-950 shadow-sm transition hover:border-gold-500 hover:text-brand-700 ${focusRing}`
const solidButton = `inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-ink-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 ${focusRing}`

function signOut() {
  logout()
  window.location.href = '/'
}

export function Header() {
  const location = useLocation()
  const user = getCurrentUser()
  const isLanding = location.pathname === '/' || location.pathname === '/solucoes/recrutamento'
  const scrolled = useScrolledPast(24)
  // Open for the current location only: any navigation closes the mobile menu without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null)
  const menuOpen = openAt === location.key
  const headerRef = useRef<HTMLElement>(null)
  // Landing pages start with a transparent header over the hero and gain a surface once scrolled.
  const transparent = isLanding && !scrolled && !menuOpen

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenAt(null)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) setOpenAt(null)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [menuOpen])

  const closeMenu = () => setOpenAt(null)

  return (
    <header
      ref={headerRef}
      className={`fixed inset-x-0 top-0 z-40 border-b transition-colors duration-300 ${
        transparent
          ? 'border-transparent bg-transparent'
          : isLanding
            ? 'border-slate-200/70 bg-white/95 shadow-sm backdrop-blur-md'
            : 'border-slate-200/80 bg-white/95 shadow-sm backdrop-blur'
      }`}
    >
      <Container className="flex h-20 items-center justify-between gap-6 lg:h-24">
        <Logo />

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Principal">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-[15px] font-medium text-ink-800 transition hover:text-brand-700 ${focusRing}`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <>
              <span className="max-w-40 truncate text-sm font-medium text-ink-700">Olá, {firstName(user.name)}</span>
              <Link to={roleHome(user.role)} className={solidButton}>
                Meu painel
              </Link>
              <button type="button" onClick={signOut} className={outlineButton}>
                Sair
              </button>
            </>
          ) : (
            <a href="/login" className={outlineButton}>
              Entrar
            </a>
          )}
        </div>

        <button
          type="button"
          className={`inline-flex h-11 w-11 items-center justify-center rounded-lg border border-ink-950/15 bg-white text-ink-950 shadow-sm lg:hidden ${focusRing}`}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          aria-controls="menu-celular"
          onClick={() => setOpenAt(menuOpen ? null : location.key)}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </Container>

      {menuOpen ? (
        <nav id="menu-celular" className="border-t border-slate-200/80 bg-white lg:hidden" aria-label="Principal no celular">
          <Container className="grid gap-1 py-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className={`flex min-h-12 items-center rounded-lg px-3 text-base font-semibold text-ink-800 transition hover:bg-slate-50 hover:text-brand-700 ${focusRing}`}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 grid gap-3 border-t border-slate-200 pt-4">
              {user ? (
                <>
                  <p className="px-3 text-sm text-ink-600">
                    Entrou como <strong className="text-ink-950">{user.name}</strong>
                  </p>
                  <Link to={roleHome(user.role)} onClick={closeMenu} className={`${solidButton} min-h-12`}>
                    Meu painel
                  </Link>
                  <button type="button" onClick={signOut} className={`${outlineButton} min-h-12`}>
                    Sair
                  </button>
                </>
              ) : (
                <a href="/login" onClick={closeMenu} className={`${solidButton} min-h-12`}>
                  Entrar
                </a>
              )}
            </div>
          </Container>
        </nav>
      ) : null}
    </header>
  )
}
