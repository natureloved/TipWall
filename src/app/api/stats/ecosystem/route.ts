import { NextResponse } from 'next/server'
import { getEcosystemStats } from '@/lib/kv'
import { VERIFIED_ECOSYSTEM_STATS, withVerifiedEcosystemMinimum } from '@/lib/public-snapshot'

// Cached at the edge for 5 min - this feeds a home-page social-proof strip, so
// slightly stale figures are fine and we avoid scanning every wall per request.
export const revalidate = 300

export async function GET() {
  try {
    const stats = await getEcosystemStats()
    return NextResponse.json({ ...withVerifiedEcosystemMinimum(stats), stale: false })
  } catch {
    return NextResponse.json({ ...VERIFIED_ECOSYSTEM_STATS, stale: true }, { status: 200 })
  }
}
