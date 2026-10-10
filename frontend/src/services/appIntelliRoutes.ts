// Where the AppIntelli chat bubble may appear. Only the commercial pages (home and solutions; "Para empresas" is
// a section of the home): on the job pages, auth pages and dashboards it would cover the main buttons on phones.
// No runtime imports: the tests load this file directly.

const COMMERCIAL_PREFIXES = ['/solucoes/']

export function isCommercialPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  return path === '/' || path === '/solucoes' || COMMERCIAL_PREFIXES.some((prefix) => path.startsWith(prefix))
}

/** Attribute on <html> that index.css uses to hide the widget's own elements outside the commercial pages. */
export const APPINTELLI_VISIBILITY_ATTRIBUTE = 'data-appintelli'
