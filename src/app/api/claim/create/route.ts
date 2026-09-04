import { NextRequest, NextResponse } from 'next/server'
import { getProfile, createClaim, trackEvent, checkRateLimit } from '@/lib/kv'
import { normalizeHandle } from '@/lib/profile-auth'
import { type ClaimIntent, type TipReason } from '@/lib/types'
import { getClientIp } from '@/lib/request'
import { logError } from '@/lib/logger'

const VALID_REASONS: TipReason[] = ['helpful_content', 'open_source', 'tutorial', 'great_idea', 'just_support']

/**
 * Create a non-custodial claim intent. Reserves tip details under a token so
 * the user can complete the tip from any device inside Nimiq Pay. No funds are
 * held. Claims only preserve a one-time tip intent until it is completed.
 */
export async function POST(req: NextRequest) {
  try {
    // Each claim is a 30-day KV record - rate-limit per IP so this can't be
    // used to balloon storage.
    const ip = getClientIp(req)
    const withinLimit = await checkRateLimit(`claim:${ip}`, 5, 60000)
    if (!withinLimit) {
      return NextResponse.json({ error: 'Rate limit exceeded, please try again shortly' }, { status: 429 })
    }

    const body = await req.json()
    const handle = normalizeHandle(String(body.creatorHandle || body.handle || ''))
    const amountNIM = Number(body.amountNIM)
    // Monthly pledges were removed until a real reminder/recurrence service
    // exists. Do not accept the old API shape and imply that anything repeats.
    if (body.source === 'pledge' || body.recurrence === 'monthly') {
      return NextResponse.json({ error: 'Monthly pledges are not available' }, { status: 410 })
    }
    const source = 'redirect' as const

    if (!handle) return NextResponse.json({ error: 'Missing creator handle' }, { status: 400 })
    if (!Number.isFinite(amountNIM) || amountNIM < 1) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const profile = await getProfile(handle)
    if (!profile) return NextResponse.json({ error: 'Creator not found' }, { status: 404 })

    const reason = VALID_REASONS.includes(body.reason) ? (body.reason as TipReason) : undefined
    // Full 128-bit bearer token. Claim URLs are capabilities, so shortening the
    // UUID needlessly reduces resistance to guessing and enumeration.
    const token = crypto.randomUUID().replace(/-/g, '')

    const claim: ClaimIntent = {
      token,
      creatorHandle: handle,
      amountNIM,
      message: body.message ? String(body.message).slice(0, 64) : undefined,
      reason,
      source,
      claimed: false,
      createdAt: Date.now(),
    }

    await createClaim(claim)
    await trackEvent(handle, 'CLAIM_LINK_CREATED')

    return NextResponse.json({ success: true, token, claimUrl: `/claim/${token}` })
  } catch (err) {
    logError('claim_create_failed', err)
    const message = err instanceof Error ? err.message : 'Failed to create claim'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
