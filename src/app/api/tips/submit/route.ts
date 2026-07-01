import { NextRequest, NextResponse } from 'next/server'
import { getProfile, getTips, addTip, addMilestone, markClaimClaimed, trackEvent, checkRateLimit, verifiedTotal } from '@/lib/kv'
import { Tip, MilestoneEvent } from '@/lib/types'
import { checkMilestone } from '@/lib/milestones'
import { verifyTx } from '@/lib/verify-tx'

const RATE_LIMIT_WINDOW = 60000
const MAX_TIPS_PER_WINDOW = 5

function getRateLimitKey(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const deviceId = req.headers.get('x-device-id') || 'unknown'
  return `${ip}:${deviceId}`
}

export async function POST(req: NextRequest) {
  // KV-backed rate limit so it holds across serverless instances.
  const withinLimit = await checkRateLimit(getRateLimitKey(req), MAX_TIPS_PER_WINDOW, RATE_LIMIT_WINDOW)
  if (!withinLimit) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait before sending another tip.' }, { status: 429 })
  }

  try {
    const body = (await req.json()) as Partial<Tip> & { handle?: string; txHash?: string }
    if (!body.handle || !body.senderAddress || !body.txHash || typeof body.amountNIM !== 'number') {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 })
    }
    if (!Number.isFinite(body.amountNIM) || body.amountNIM < 1) {
      return NextResponse.json({ error: 'invalid amount' }, { status: 400 })
    }
    const handle: string = body.handle
    const profile = await getProfile(handle)
    if (!profile) {
      return NextResponse.json({ error: 'creator not found' }, { status: 404 })
    }

    const existing = await getTips(handle)

    // Reject replays: a txHash can only fund one tip.
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

    // 'verified' → confirmed on-chain. 'unavailable' → indexer lag/downtime, so
    // record it as unverified ("Pending") rather than dropping it: the sender's
    // wallet already executed the transaction, so a real tip is never lost.
    const verified = verifyResult === 'verified'

    // Milestones fire off verified totals only, so a pending (or fabricated) tip
    // can't trigger a celebration until it actually confirms on-chain.
    const previousTotal = verifiedTotal(existing)
    const newTotal = previousTotal + (verified ? body.amountNIM : 0)

    const tip: Tip = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      handle,
      senderAddress: body.senderAddress,
      amountNIM: body.amountNIM,
      txHash: body.txHash,
      verified,
      timestamp: (body as any).timestamp ?? Date.now(),
      reason: body.reason,
      message: (body.message || '').slice(0, 64),
      anonymous: !!body.anonymous,
    }

    await addTip(handle, tip)

    let milestone: MilestoneEvent | null = null
    const milestoneEvent = checkMilestone(previousTotal, newTotal, tip.senderAddress)
    if (milestoneEvent) {
      const added = await addMilestone(handle, milestoneEvent)
      if (added) milestone = milestoneEvent
    }

    // Conversion funnel: a tip completed. If it fulfils a claim intent, mark it
    // claimed and count it as a recovered supporter.
    await trackEvent(handle, 'TIP_COMPLETED')
    const claimToken = (body as any).claimToken
    if (claimToken) {
      const wasOpen = await markClaimClaimed(String(claimToken), body.txHash)
      if (wasOpen) await trackEvent(handle, 'RETURNED_AFTER_INSTALL')
    }

    return NextResponse.json({ success: true, tip, milestone, pending: !verified })
  } catch (err: any) {
    console.error('Tip submission error:', err)
    return NextResponse.json({ error: err.message || 'Failed to submit tip' }, { status: 500 })
  }
}
