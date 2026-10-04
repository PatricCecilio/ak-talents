/**
 * What the Home "Vagas em destaque" section shows:
 * - live: real jobs from the API;
 * - demo: sample jobs, only allowed in local development (`npm run dev`);
 * - unavailable: no real jobs (or API down) in any production build, including Vercel previews.
 */
export type FeaturedJobsMode = 'live' | 'demo' | 'unavailable'

/** `liveJobsCount` is null when the API call failed. */
export function resolveFeaturedJobsMode(liveJobsCount: number | null, allowDemoJobs: boolean): FeaturedJobsMode {
  if (liveJobsCount !== null && liveJobsCount > 0) return 'live'
  return allowDemoJobs ? 'demo' : 'unavailable'
}
