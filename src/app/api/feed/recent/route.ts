import { NextResponse } from 'next/server'
import { getDiscoveryHandles, getTips } from '@/lib/kv'
import { buildRecentFeed } from '@/lib/feed'
import type { Tip } from '@/lib/types'

// Real network activity for the home page ticker. Cached briefly so a
// homepage visit costs one scan, not one per wall per visitor.
export const revalidate = 60

export async function GET() {
  try {
    const handles = await getDiscoveryHandles(24)
    const settled = await Promise.allSettled(handles.map(h => getTips(h)))
    const perWall = handles
      .map((handle, i) => {
        const result = settled[i]
        return result.status === 'fulfilled' ? { handle, tips: result.value } : null
      })
      .filter((w): w is { handle: string; tips: Tip[] } => w != null)
    return NextResponse.json({ items: buildRecentFeed(perWall, 8), stale: false })
  } catch {
    return NextResponse.json({ items: [], stale: true }, { status: 200 })
  }
}
