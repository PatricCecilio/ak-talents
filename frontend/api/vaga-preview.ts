// Vercel Function used ONLY for link-preview robots (WhatsApp, Facebook, LinkedIn...) on /vagas/<slug>: see the
// user-agent rewrite in vercel.json. People keep getting the static site. Logic: src/services/jobPreviewMeta.ts.
import { renderJobPreview } from '../src/services/jobPreviewMeta.js'

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const html = await renderJobPreview({
    slug: url.searchParams.get('slug') ?? '',
    siteOrigin: url.origin,
    apiBase: process.env.VITE_API_BASE_URL ?? '',
    fetchImpl: fetch,
  })
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Robots re-fetch often; the job text changes rarely.
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
