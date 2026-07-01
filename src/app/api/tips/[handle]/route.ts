import { NextResponse } from 'next/server'
import { getProfile, reverifyPendingTips, getSupporters, verifiedTotal } from '@/lib/kv'

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const profile = await getProfile(handle)
  if (!profile) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  // Re-check any pending tips (indexer may have caught up) before reading.
  const tips = await reverifyPendingTips(handle, profile.walletAddress)
  const supporters = await getSupporters(handle)
  const totalNIM = verifiedTotal(tips)
  return NextResponse.json({ tips, supporters, totalNIM })
}
