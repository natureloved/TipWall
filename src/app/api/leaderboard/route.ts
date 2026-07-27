import { NextResponse } from 'next/server'
import { getActiveHandles, getProfile, getTips, LEADERBOARD_WINDOW_MS } from '@/lib/kv'
import { kv } from '@vercel/kv'
import type { Tip } from '@/lib/types'

export const revalidate = 300

const MAX_WALLS = 24
const PROFILE_PREFIX = 'tipwall:profile:'

export async function GET() {
  try {
    let handles = await getActiveHandles(MAX_WALLS)
    if (handles.length < MAX_WALLS) {
      try {
        const keys = await kv.keys(`${PROFILE_PREFIX}*`)
        const allHandles = keys.map((k: string) => k.slice(PROFILE_PREFIX.length))
        const seen = new Set(handles)
        handles = [...handles, ...allHandles.filter((h: string) => !seen.has(h)).slice(0, MAX_WALLS - handles.length)]
      } catch { /* best effort */ }
    }

    const cutoff = Date.now() - LEADERBOARD_WINDOW_MS
    const results = await Promise.all(
      handles.slice(0, MAX_WALLS).map(async (handle: string) => {
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
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
