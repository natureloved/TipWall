import { NextRequest, NextResponse } from 'next/server'
import {
  getProfile, getTips, addTip, addMilestone, markClaimClaimed, getClaim,
  trackEvent, checkRateLimit, markTxSeen, getVerifiedTotalNim, addVerifiedNim,
} from '@/lib/kv'
import { Tip, MilestoneEvent, TipReason } from '@/lib/types'
import { checkMilestone } from '@/lib/milestones'
import { verifyTx } from '@/lib/verify-tx'

const RATE_LIMIT_WINDOW = 60000
const MAX_TIPS_PER_WINDOW = 5
/** Sanity ceiling — far above any real tip, blocks absurd stored values. */
const MAX_TIP_NIM = 100_000_000

/**
 * Rate-limit by IP only. Client-supplied headers (like a device id) must not be
 * part of the key: an attacker could rotate them to mint a fresh bucket per
 * request, making the limit a no-op.
 */
function getRateLimitKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = (forwarded ? forwarded.split(',')[0].trim() : '') || req.headers.get('x-real-ip') || 'unknown'
  return `tip:${ip}`
}

interface TipSubmitBody {
  handle?: string
  senderAddress?: string
  txHash?: string
  amountNIM?: number
  reason?: TipReason
  message?: string
  anonymous?: boolean
  claimToken?: string
}

export async function POST(req: NextRequest) {
  // KV-backed rate limit so it holds across serverless instances.
  const withinLimit = await checkRateLimit(getRateLimitKey(req), MAX_TIPS_PER_WINDOW, RATE_LIMIT_WINDOW)
  if (!withinLimit) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait before sending another tip.' }, { status: 429 })
  }

  try {
    const body = (await req.json()) as TipSubmitBody
    if (!body.handle || !body.senderAddress || !body.txHash || typeof body.amountNIM !== 'number') {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 })
    }
    if (!Number.isFinite(body.amountNIM) || body.amountNIM < 1 || body.amountNIM > MAX_TIP_NIM) {
      return NextResponse.json({ error: 'invalid amount' }, { status: 400 })
    }
    const handle: string = body.handle
    const profile = await getProfile(handle)
    if (!profile) {
      return NextResponse.json({ error: 'creator not found' }, { status: 404 })
    }

    // Replay protection, phase 1: cheap check against recorded tips (also
    // covers tips recorded before the persistent hash set existed).
    const existing = await getTips(handle)
    if (existing.some(t => t.txHash === body.txHash)) {
      return NextResponse.json({ error: 'tip already recorded for this transaction' }, { status: 409 })
    }

    // Best-effort on-chain verification.
    const verifyResult = await verifyTx(body.txHash, profile.walletAddress, Math.round(body.amountNIM * 100000))

    // Found on-chain but going to the wrong recipient / wrong amount: this hash
    // does not fund a tip to this creator. Reject it as a forgery or mistake.
    if (verifyResult === 'mismatch') {
      return NextResponse.json({ error: 'transaction does not match this tip' }, { status: 402 })
    }

    // Replay protection, phase 2: atomically claim the hash in the lifetime
    // seen-set. Done AFTER verification so a transient failure above can't burn
    // a hash that was never recorded; SADD guarantees one winner on a race.
    const isNewTx = await markTxSeen(handle, body.txHash)
    if (!isNewTx) {
      return NextResponse.json({ error: 'tip already recorded for this transaction' }, { status: 409 })
    }

    // 'verified' → confirmed on-chain. 'unavailable' → indexer lag/downtime, so
    // record it as unverified ("Pending") rather than dropping it: the sender's
    // wallet already executed the transaction, so a real tip is never lost.
    const verified = verifyResult === 'verified'

    const tip: Tip = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      handle,
      senderAddress: body.senderAddress,
      amountNIM: body.amountNIM,
      txHash: body.txHash,
      verified,
      // Server clock only — a client-supplied timestamp could backdate a tip
      // past the re-verification guard or skew the dashboard charts.
      timestamp: Date.now(),
      reason: body.reason,
      message: (body.message || '').slice(0, 64),
      anonymous: !!body.anonymous,
    }

    await addTip(handle, tip)

    // Milestones fire off the lifetime verified counter, so a pending (or
    // fabricated) tip can't trigger a celebration until it confirms on-chain.
    const previousTotal = await getVerifiedTotalNim(handle)
    const newTotal = verified ? await addVerifiedNim(handle, tip.amountNIM) : previousTotal

    let milestone: MilestoneEvent | null = null
    const milestoneEvent = checkMilestone(previousTotal, newTotal, tip.anonymous ? 'Anonymous' : tip.senderAddress)
    if (milestoneEvent) {
      const added = await addMilestone(handle, milestoneEvent)
      if (added) milestone = milestoneEvent
    }

    // Conversion funnel: a tip completed. If it fulfils a claim intent FOR THIS
    // CREATOR, mark it claimed — a token must not close someone else's claim.
    await trackEvent(handle, 'TIP_COMPLETED')
    if (body.claimToken) {
      const claim = await getClaim(String(body.claimToken))
      if (claim && claim.creatorHandle === handle.toLowerCase()) {
        const wasOpen = await markClaimClaimed(claim.token, body.txHash)
        if (wasOpen) await trackEvent(handle, 'RETURNED_AFTER_INSTALL')
      }
    }

    return NextResponse.json({ success: true, tip, milestone, pending: !verified })
  } catch (err) {
    console.error('Tip submission error:', err)
    const message = err instanceof Error ? err.message : 'Failed to submit tip'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
