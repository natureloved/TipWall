import { NextRequest, NextResponse } from 'next/server'
import { trackEvent, checkRateLimit } from '@/lib/kv'
import { normalizeHandle } from '@/lib/profile-auth'
import { isFunnelEvent } from '@/lib/events'

/**
 * Record an anonymous funnel event. Body: { handle, event, cid? }.
 * `cid` is an anonymous client id used only to dedupe view events per day.
 * No IP or PII is stored.
 */
export async function POST(req: NextRequest) {
  try {
    // Per-IP rate limit so a script can't inflate a creator's funnel counters.
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = (forwarded ? forwarded.split(',')[0].trim() : '') || 'unknown'
    const withinLimit = await checkRateLimit(`track:${ip}`, 60, 60000)
    if (!withinLimit) return NextResponse.json({ ok: false }, { status: 429 })

    const body = await req.json()
    const handle = normalizeHandle(String(body.handle || ''))
    const event = body.event
    if (!handle || !isFunnelEvent(event)) {
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
    }
    // Dedupe only view-type events; actions should always count.
    const dedupKey = event === 'TIP_WALL_VIEWED' && body.cid ? String(body.cid).slice(0, 64) : undefined
    await trackEvent(handle, event, dedupKey)
    return NextResponse.json({ ok: true })
  } catch {
    // Tracking must never surface errors to the user.
    return NextResponse.json({ ok: false })
  }
}
