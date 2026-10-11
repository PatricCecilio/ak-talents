// Share previews of a job page (WhatsApp, Facebook, LinkedIn...). Those robots do not run JavaScript, so
// api/vaga-preview.ts serves them index.html with the job's title and description already in the <head>.
// No runtime imports: used by the Vercel Function and loaded directly by the tests.

export const SITE_URL = 'https://www.aktalent.com.br'
export const SITE_NAME = 'AK Talent'
const DESCRIPTION_LIMIT = 160

export interface PreviewJob {
  title: string
  slug: string
  description?: string | null
  location?: string | null
  salary_min?: number | null
  salary_max?: number | null
  contract_type?: string | null
}

export interface PreviewMeta {
  title: string
  description: string
  url: string
}

const CONTRACT_LABELS: Record<string, string> = { clt: 'CLT', temporary: 'Temporário', internship: 'Estágio', pj: 'PJ' }

function money(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

function salaryText(job: PreviewJob): string {
  if (job.salary_min && job.salary_max) return `${money(job.salary_min)} a ${money(job.salary_max)}`
  if (job.salary_min) return `A partir de ${money(job.salary_min)}`
  if (job.salary_max) return `Até ${money(job.salary_max)}`
  return ''
}

function clip(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= limit) return clean
  const cut = clean.slice(0, limit - 1)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), limit - 20)).trimEnd()}…`
}

export function buildJobPreviewMeta(job: PreviewJob): PreviewMeta {
  const where = job.location?.trim()
  const title = `${job.title.trim()}${where ? ` – ${where}` : ''} | ${SITE_NAME}`
  const facts = [salaryText(job), CONTRACT_LABELS[job.contract_type ?? ''] ?? ''].filter(Boolean).join(' · ')
  const body = job.description?.trim() || 'Veja os detalhes da vaga e candidate-se pelo site da AK Talent.'
  return {
    title,
    description: clip(facts ? `${facts}. ${body}` : body, DESCRIPTION_LIMIT),
    url: `${SITE_URL}/vagas/${encodeURIComponent(job.slug)}`,
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function setMeta(html: string, attribute: 'name' | 'property', key: string, value: string): string {
  // Matches the tag whether or not its content is on the next line (index.html is formatted).
  const pattern = new RegExp(`(<meta\\s+${attribute}="${key}"\\s+content=")[^"]*(")`)
  return html.replace(pattern, `$1${escapeHtml(value)}$2`)
}

/** index.html with the job's title/description/url in <title>, description, og:* and twitter:* tags. */
export function injectPreviewMeta(html: string, meta: PreviewMeta): string {
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
  out = setMeta(out, 'name', 'description', meta.description)
  out = setMeta(out, 'property', 'og:title', meta.title)
  out = setMeta(out, 'property', 'og:description', meta.description)
  out = setMeta(out, 'property', 'og:url', meta.url)
  out = setMeta(out, 'name', 'twitter:title', meta.title)
  out = setMeta(out, 'name', 'twitter:description', meta.description)
  return out
}

type FetchLike = (input: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  ok: boolean
  json: () => Promise<unknown>
  text: () => Promise<string>
}>

const VALID_SLUG = /^[a-z0-9-]{1,220}$/

/**
 * The HTML a share robot gets for /vagas/<slug>. Falls back to the plain index.html (site-wide preview) when the slug
 * is invalid, the job is not public anymore or the API is slow/unavailable — never an error page.
 */
export async function renderJobPreview(options: {
  slug: string
  siteOrigin: string
  apiBase: string
  fetchImpl: FetchLike
  timeoutMs?: number
}): Promise<string> {
  const { slug, siteOrigin, apiBase, fetchImpl, timeoutMs = 2500 } = options
  const html = await (await fetchImpl(`${siteOrigin}/index.html`)).text()
  if (!VALID_SLUG.test(slug) || !apiBase) return html
  try {
    const response = await fetchImpl(`${apiBase.replace(/\/+$/, '')}/jobs/${slug}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return html
    const job = (await response.json()) as PreviewJob
    if (!job || typeof job.title !== 'string' || typeof job.slug !== 'string') return html
    return injectPreviewMeta(html, buildJobPreviewMeta(job))
  } catch {
    return html
  }
}
