/**
 * Compact relative time for narrow stat tiles and feed rows ("2h ago").
 * Client-only: renders from Date.now(), so callers must guard against
 * hydration mismatch (see TipFeed / the stats grid).
 *
 * Output strings are intentionally English-only for now — a half-translated
 * relative-time system is worse than a consistent English one. Localizing this
 * (Intl.RelativeTimeFormat) is a separate, larger job.
 */
export function timeAgo(ts: number, now: number = Date.now()): string {
  const s = Math.floor((now - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return `${Math.floor(d / 7)}w ago`
}
