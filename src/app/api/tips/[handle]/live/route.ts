import { NextResponse } from 'next/server'
import { getTips, getVerifiedTotalNim, checkRateLimit } from '@/lib/kv'
import type { Tip } from '@/lib/types'
import { getClientIp } from '@/lib/request'

/**
 * Lightweight polling endpoint for live surfaces (stream overlay, wall
 * auto-refresh). Only verified tips are eligible for the live cursor. Pending
 * confirmations are promoted by the scheduled reconciliation worker.
 */
export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const h = handle.toLowerCase().replace(/[^a-z0-9_-]/g, '')
  if (!h) return NextResponse.json({ error: 'invalid handle' }, { status: 400 })

  const ip = getClientIp(request)
  const withinLimit = await checkRateLimit(`live:${ip}`, 120, 60000)
  if (!withinLimit) return NextResponse.json({ error: 'rate limited' }, { status: 429 })

  const tips = await getTips(h)

  const verifiedTips = tips.filter(t => t.verified && !t.hiddenAt)
  const head = verifiedTips[0]
  const after = new URL(request.url).searchParams.get('after')
  let newTips: Tip[] = []
  if (after) {
    const afterIndex = verifiedTips.findIndex(t => t.id === after)
    // If a cursor no longer exists (for example after cleanup), returning the
    // current head is the only recoverable event and may produce one duplicate
    // rather than a silent gap.
    newTips = afterIndex >= 0 ? verifiedTips.slice(0, afterIndex) : (head ? [head] : [])
  }
  const totalNIM = await getVerifiedTotalNim(h).catch(() => 0)

  // Inline sanitize: anonymous tips must never leak their sender through the
  // live surface either. Preserve the asset so USDT alerts show the right unit.
  const toLiveTip = (tip: Tip) => tip.anonymous
    ? { id: tip.id, amountNIM: tip.amountNIM, asset: tip.asset, amountUSDT: tip.amountUSDT, message: tip.message, reason: tip.reason, senderName: undefined, anonymous: true, timestamp: tip.timestamp }
    : { id: tip.id, amountNIM: tip.amountNIM, asset: tip.asset, amountUSDT: tip.amountUSDT, message: tip.message, reason: tip.reason, senderName: tip.senderName, anonymous: false, timestamp: tip.timestamp }

  const latest = head ? toLiveTip(head) : null

  return NextResponse.json(
    {
      headTipId: head?.id ?? null,
      latest,
      newTips: newTips.map(toLiveTip),
      totalNIM,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
