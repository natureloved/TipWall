import { NextResponse } from 'next/server'
import { getProfile, getTips, reverifyPendingTips, getVerifiedTotalNim, checkRateLimit } from '@/lib/kv'
import type { Tip } from '@/lib/types'

/**
 * Lightweight polling endpoint for live surfaces (stream overlay, wall
 * auto-refresh). Only verified tips are eligible for the live cursor. Mature
 * pending tips are rechecked here so an overlay can observe a later
 * confirmation even when no full wall request is made.
 */
export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const h = handle.toLowerCase().replace(/[^a-z0-9_-]/g, '')
  if (!h) return NextResponse.json({ error: 'invalid handle' }, { status: 400 })

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = (forwarded ? forwarded.split(',')[0].trim() : '') || request.headers.get('x-real-ip') || 'unknown'
  const withinLimit = await checkRateLimit(`live:${ip}`, 120, 60000)
  if (!withinLimit) return NextResponse.json({ error: 'rate limited' }, { status: 429 })

  let tips = await getTips(h)
  if (tips.some(t => !t.verified && Date.now() - t.timestamp > 20000)) {
    const profile = await getProfile(h)
    if (profile) tips = await reverifyPendingTips(h, profile.walletAddress)
  }

  const verifiedTips = tips.filter(t => t.verified)
  const head = verifiedTips[0]
  const after = new URL(request.url).searchParams.get('after')
  let newTips: Tip[] = []
  if (after) {
    const afterIndex = verifiedTips.findIndex(t => t.id === after)
    // If the cursor was trimmed, returning the current head is the only
    // recoverable event and may produce one duplicate rather than a silent gap.
    newTips = afterIndex >= 0 ? verifiedTips.slice(0, afterIndex) : (head ? [head] : [])
  }
  const totalNIM = await getVerifiedTotalNim(h).catch(() => 0)

  // Inline sanitize: anonymous tips must never leak their sender through the
  // live surface either.
  const latest = head
    ? (head.anonymous
      ? { id: head.id, amountNIM: head.amountNIM, message: head.message, reason: head.reason, senderName: undefined, anonymous: true, timestamp: head.timestamp }
      : { id: head.id, amountNIM: head.amountNIM, message: head.message, reason: head.reason, senderName: head.senderName, anonymous: false, timestamp: head.timestamp })
    : null

  return NextResponse.json(
    {
      headTipId: head?.id ?? null,
      latest,
      newTips: newTips.map(t => t.anonymous
        ? { id: t.id, amountNIM: t.amountNIM, message: t.message, reason: t.reason, senderName: undefined, anonymous: true, timestamp: t.timestamp }
        : { id: t.id, amountNIM: t.amountNIM, message: t.message, reason: t.reason, senderName: t.senderName, anonymous: false, timestamp: t.timestamp }),
      totalNIM,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
