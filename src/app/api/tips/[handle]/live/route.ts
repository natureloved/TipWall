import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { getVerifiedTotalNim, checkRateLimit } from '@/lib/kv'
import type { Tip } from '@/lib/types'

/**
 * Ultra-light polling endpoint for live surfaces (stream overlay, wall
 * auto-refresh). Reads only the list head and the lifetime counter - never
 * reverifyPendingTips or supporter derivation - so 5s polling stays cheap.
 */
export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const h = handle.toLowerCase().replace(/[^a-z0-9_-]/g, '')
  if (!h) return NextResponse.json({ error: 'invalid handle' }, { status: 400 })

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = (forwarded ? forwarded.split(',')[0].trim() : '') || request.headers.get('x-real-ip') || 'unknown'
  const withinLimit = await checkRateLimit(`live:${ip}`, 120, 60000)
  if (!withinLimit) return NextResponse.json({ error: 'rate limited' }, { status: 429 })

  const [head] = (await kv.lrange<Tip>(`tipwall:tips:${h}`, 0, 0)) || []
  const totalNIM = await getVerifiedTotalNim(h).catch(() => 0)

  // Inline sanitize: anonymous tips must never leak their sender through the
  // live surface either.
  const latest = head
    ? (head.anonymous
      ? { id: head.id, amountNIM: head.amountNIM, message: head.message, reason: head.reason, senderName: undefined, anonymous: true, timestamp: head.timestamp }
      : { id: head.id, amountNIM: head.amountNIM, message: head.message, reason: head.reason, senderName: head.senderName, anonymous: false, timestamp: head.timestamp })
    : null

  return NextResponse.json(
    { headTipId: head?.id ?? null, latest, totalNIM },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
