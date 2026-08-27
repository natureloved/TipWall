import { NextResponse } from 'next/server'
import { getEcosystemStats } from '@/lib/kv'

// Cached at the edge for 5 min - this feeds a home-page social-proof strip, so
// slightly stale figures are fine and we avoid scanning every wall per request.
export const revalidate = 300

export async function GET() {
  try {
    const stats = await getEcosystemStats()
    return NextResponse.json(stats)
  } catch {
    // Never break the home page over a stats read.
    return NextResponse.json(
      { walls: 0, tippedCreators: 0, totalNIM: 0, totalTips: 0 },
      { status: 200 },
    )
  }
}
