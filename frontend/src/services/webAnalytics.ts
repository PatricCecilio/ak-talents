// Vercel Web Analytics (no cookies, no visitor identification). Only public pages are counted, always without the
// query string or hash (no ?codigo=, e-mail, utm...). Pure functions, only a type import: the tests load this file.
import type { BeforeSendEvent } from '@vercel/analytics/react'

// Home, campaign page, job list, job page and privacy policy.
const PUBLIC_PATHS: RegExp[] = [/^\/$/, /^\/solucoes\/recrutamento$/, /^\/vagas$/, /^\/vagas\/[a-z0-9-]+$/, /^\/privacidade$/]

/** Path without query string, hash or trailing slash ("/vagas/" -> "/vagas"). */
export function sanitizePagePath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] || '/'
  return path.length > 1 ? path.replace(/\/+$/, '') || '/' : '/'
}

export function isPublicPage(pathname: string): boolean {
  const path = sanitizePagePath(pathname)
  return PUBLIC_PATHS.some((pattern) => pattern.test(path))
}

/** beforeSend: drops internal, login and sign-up pages; sends public ones as origin + clean path only. */
export function publicPagesOnly(event: BeforeSendEvent): BeforeSendEvent | null {
  let url: URL
  try {
    url = new URL(event.url)
  } catch {
    return null
  }
  if (!isPublicPage(url.pathname)) return null
  return { ...event, url: `${url.origin}${sanitizePagePath(url.pathname)}` }
}
