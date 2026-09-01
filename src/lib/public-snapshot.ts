export type PublicEcosystemStats = {
  walls: number
  tippedCreators: number
  totalNIM: number
  totalTips: number
  /** Verified tips per reason; feeds the home page's live signal card. */
  reasonCounts: Record<string, number>
}

// Last verified public totals. These cumulative values are a safe floor while
// the live KV endpoint reconnects or a cached response is refreshing. The
// reason-count floor is empty on purpose: a signal card without live data
// shows honest fallback copy instead of invented percentages.
export const VERIFIED_ECOSYSTEM_STATS: PublicEcosystemStats = {
  walls: 8,
  tippedCreators: 8,
  totalNIM: 18_855,
  totalTips: 0,
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
    reasonCounts:
      liveReasons && typeof liveReasons === 'object' && Object.keys(liveReasons).length > 0
        ? liveReasons
        : {},
  }
}
