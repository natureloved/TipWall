export type PublicEcosystemStats = {
  walls: number
  tippedCreators: number
  totalNIM: number
  totalTips: number
  /** Verified tips in the trailing 7 days; only shown above a floor. */
  tipsThisWeek: number
  /** Verified tips per reason; feeds the home page's live signal card. */
  reasonCounts: Record<string, number>
}

// Last verified public totals. These cumulative values are a safe floor while
// the live KV endpoint reconnects or a cached response is refreshing. The
// reason-count floor is empty on purpose: a signal card without live data
// shows honest fallback copy instead of invented percentages.
//
// `totalTips` MUST stay a real verified figure, not 0. It was 0 while nothing
// rendered it; the home page now shows it, and a 0 made the stats strip drop
// that slot from the server-rendered HTML and then grow a third column on
// hydration - a layout shift above the fold on the landing page. Keep it in
// step with reality when you bump the other floors.
//
// `tipsThisWeek` floors at 0 rather than a known-good value: a weekly window
// legitimately can be empty, and the consumer only shows it above a floor, so
// a stale response degrades to the all-time figure instead of overstating.
export const VERIFIED_ECOSYSTEM_STATS: PublicEcosystemStats = {
  walls: 8,
  tippedCreators: 8,
  totalNIM: 18_855,
  totalTips: 67,
  tipsThisWeek: 0,
  reasonCounts: {},
}

export function withVerifiedEcosystemMinimum(
  live?: Partial<PublicEcosystemStats> | null,
): PublicEcosystemStats {
  const liveReasons = live?.reasonCounts
  return {
    walls: Math.max(VERIFIED_ECOSYSTEM_STATS.walls, Number(live?.walls ?? 0) || 0),
    tippedCreators: Math.max(
      VERIFIED_ECOSYSTEM_STATS.tippedCreators,
      Number(live?.tippedCreators ?? 0) || 0,
    ),
    totalNIM: Math.max(VERIFIED_ECOSYSTEM_STATS.totalNIM, Number(live?.totalNIM ?? 0) || 0),
    totalTips: Math.max(VERIFIED_ECOSYSTEM_STATS.totalTips, Number(live?.totalTips ?? 0) || 0),
    tipsThisWeek: Math.max(
      VERIFIED_ECOSYSTEM_STATS.tipsThisWeek,
      Number(live?.tipsThisWeek ?? 0) || 0,
    ),
    reasonCounts:
      liveReasons && typeof liveReasons === 'object' && Object.keys(liveReasons).length > 0
        ? liveReasons
        : {},
  }
}

// Keep the portable wall format discoverable alongside the public snapshot
// helpers used by the site-wide statistics surface.
export * from './wall-snapshot'
