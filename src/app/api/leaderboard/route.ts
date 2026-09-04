import { NextResponse } from 'next/server'
import { getDiscoveryHandles, getProfile, getTips, LEADERBOARD_WINDOW_MS } from '@/lib/kv'
import type { Tip } from '@/lib/types'
import { withinRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export const revalidate = 300

const MAX_WALLS = 24

export async function GET(request: Request) {
  if (!await withinRateLimit(request, 'leaderboard-read', 30)) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  }
  try {
    const handles = await getDiscoveryHandles(MAX_WALLS)

    const cutoff = Date.now() - LEADERBOARD_WINDOW_MS
    const results = await Promise.all(
      handles.map(async (handle: string) => {
        const [profile, tips] = await Promise.all([getProfile(handle), getTips(handle)])
        if (!profile) return null
        const recentNIM = tips.reduce(
          (sum: number, t: Tip) => (t.verified && t.timestamp >= cutoff ? sum + (t.amountNIM || 0) : sum),
          0,
        )
        return { handle, recentNIM }
      }),
    )

    const ranked = results
      .filter((r): r is { handle: string; recentNIM: number } => r !== null && r.recentNIM > 0)
      .sort((a, b) => b.recentNIM - a.recentNIM)
      .slice(0, 3)
      .map((r, i) => ({ ...r, rank: i + 1 }))

    return NextResponse.json(ranked)
  } catch (error) {
    logError('leaderboard_unavailable', error)
    return NextResponse.json(
      { error: 'Leaderboard data is temporarily unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
