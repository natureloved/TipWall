import { NextResponse } from 'next/server'
import { getProfile, getTips, getSupporters, getVerifiedTotalNim, sanitizeTips } from '@/lib/kv'
import { withinRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  if (!await withinRateLimit(request, 'tips-read', 120)) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  }
  const { handle } = await params
  const profile = await getProfile(handle)
  if (!profile) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  // GET is intentionally read-only. Pending-tip reconciliation runs from the
  // authenticated scheduled worker, so public traffic cannot trigger writes or
  // upstream verification fan-out.
  const tips = await getTips(handle)
  const supporters = await getSupporters(handle)
  const totalNIM = await getVerifiedTotalNim(handle)
  // Anonymous tips must leave the server without their sender address.
  return NextResponse.json({ tips: sanitizeTips(tips), supporters, totalNIM })
}
