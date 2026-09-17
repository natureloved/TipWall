import { NextResponse } from 'next/server'
import { getEcosystemStats } from '@/lib/kv'
import { VERIFIED_ECOSYSTEM_STATS, withVerifiedEcosystemMinimum } from '@/lib/public-snapshot'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
}

export async function GET() {
  try {
    const stats = await getEcosystemStats()
    return NextResponse.json(
      { ...withVerifiedEcosystemMinimum(stats), stale: false },
      { status: 200, headers: NO_CACHE_HEADERS }
    )
  } catch {
    return NextResponse.json(
      { ...VERIFIED_ECOSYSTEM_STATS, stale: true },
      { status: 200, headers: NO_CACHE_HEADERS }
    )
  }
}

