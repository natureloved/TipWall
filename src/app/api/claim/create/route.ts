import { NextRequest, NextResponse } from 'next/server'
import { getProfile, createClaim, trackEvent, checkRateLimit } from '@/lib/kv'
import { normalizeHandle } from '@/lib/profile-auth'
import { type ClaimIntent, type TipReason } from '@/lib/types'

const VALID_REASONS: TipReason[] = ['helpful_content', 'open_source', 'tutorial', 'great_idea', 'just_support']

/**
 * Create a non-custodial claim intent. Reserves tip details under a token so
 * the user can complete the tip from any device inside Nimiq Pay. No funds are
 * held. `source` distinguishes an install-redirect from an explicit pledge.
 */
export async function POST(req: NextRequest) {
  try {
    // Each claim is a 30-day KV record — rate-limit per IP so this can't be
    // used to balloon storage.
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = (forwarded ? forwarded.split(',')[0].trim() : '') || 'unknown'
    const withinLimit = await checkRateLimit(`claim:${ip}`, 5, 60000)
    if (!withinLimit) {
      return NextResponse.json({ error: 'Rate limit exceeded, please try again shortly' }, { status: 429 })
    }

    const body = await req.json()
    const handle = normalizeHandle(String(body.creatorHandle || body.handle || ''))
    const amountNIM = Number(body.amountNIM)
    const source = body.source === 'pledge' ? 'pledge' : 'redirect'

    if (!handle) return NextResponse.json({ error: 'Missing creator handle' }, { status: 400 })
    if (!Number.isFinite(amountNIM) || amountNIM < 1) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const profile = await getProfile(handle)
    if (!profile) return NextResponse.json({ error: 'Creator not found' }, { status: 404 })

    const reason = VALID_REASONS.includes(body.reason) ? (body.reason as TipReason) : undefined
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)

    const claim: ClaimIntent = {
      token,
      creatorHandle: handle,
      amountNIM,
      message: body.message ? String(body.message).slice(0, 64) : undefined,
      reason,
      // Email intentionally deferred for v1 (privacy). Field kept for forward-compat.
      source,
      claimed: false,
      createdAt: Date.now(),
    }

    await createClaim(claim)
    await trackEvent(handle, 'CLAIM_LINK_CREATED')

    return NextResponse.json({ success: true, token, claimUrl: `/claim/${token}` })
  } catch (err) {
    console.error('Claim create error:', err)
    const message = err instanceof Error ? err.message : 'Failed to create claim'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
