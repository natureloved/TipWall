import { NextResponse } from 'next/server'
import { getClaim } from '@/lib/kv'
import { withinRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!await withinRateLimit(req, 'claim-read', 60)) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  }
  const { token } = await params
  const claim = await getClaim(token)
  if (!claim) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  }
  return NextResponse.json(claim)
}
