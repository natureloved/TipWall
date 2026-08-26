import { NextRequest, NextResponse } from 'next/server'
import { getProfile, getTips, recordTipAtomically, addMilestone, markClaimClaimed, getClaim, trackEvent, checkRateLimit, getVerifiedTotalNim, addVerifiedNim, touchActivity } from '@/lib/kv'
import { Tip, MilestoneEvent, getGoalMilestones } from '@/lib/types'
import { checkMilestone } from '@/lib/milestones'
import { verifyTxDetails } from '@/lib/verify-tx'

const MAX_TIPS_PER_WINDOW = 5
const MAX_TIP_NIM = 100_000_000

function getRateLimitKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = (forwarded ? forwarded.split(',')[0].trim() : '') || req.headers.get('x-real-ip') || 'unknown'
  return `tip:${ip}`
}

export async function POST(req: NextRequest) {
  const withinLimit = await checkRateLimit(getRateLimitKey(req), MAX_TIPS_PER_WINDOW, 60000)
  if (!withinLimit) return NextResponse.json({ error: 'Rate limit exceeded. Please wait before sending another tip.' }, { status: 429 })
  try {
    const body = await req.json() as Record<string, unknown>
    const rawHandle = String(body.handle || '')
    const txHash = String(body.txHash || '')
    const amountNIM = Number(body.amountNIM)
    if (!rawHandle || !txHash || !Number.isFinite(amountNIM)) return NextResponse.json({ error: 'missing fields' }, { status: 400 })
    if (!Number.isFinite(amountNIM) || amountNIM < 1 || amountNIM > MAX_TIP_NIM || Math.round(amountNIM * 100000) !== amountNIM * 100000) return NextResponse.json({ error: 'invalid amount' }, { status: 400 })
    if (txHash.length < 32 || txHash.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(txHash)) return NextResponse.json({ error: 'invalid payment reference' }, { status: 400 })
    const handle = rawHandle.toLowerCase().replace(/[^a-z0-9_-]/g, '')
    const profile = await getProfile(handle)
    if (!profile) return NextResponse.json({ error: 'creator not found' }, { status: 404 })
    const existing = await getTips(handle)
    if (existing.some(t => t.txHash === txHash)) return NextResponse.json({ error: 'tip already recorded for this transaction' }, { status: 409 })
    const verification = await verifyTxDetails(txHash, profile.walletAddress, Math.round(amountNIM * 100000))
    if (verification.result === 'mismatch') return NextResponse.json({ error: 'transaction does not match this tip' }, { status: 402 })
    const verified = verification.result === 'verified'
    const tip: Tip = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      handle,
      senderAddress: verification.senderAddress || '',
      amountNIM,
      txHash,
      verified,
      timestamp: Date.now(),
      reason: ['helpful_content', 'open_source', 'tutorial', 'great_idea', 'just_support'].includes(String(body.reason || '')) ? body.reason as Tip['reason'] : undefined,
      message: typeof body.message === 'string' ? body.message.slice(0, 64) : '',
      anonymous: body.anonymous === true,
    }
    if (!await recordTipAtomically(handle, txHash, tip)) return NextResponse.json({ error: 'tip already recorded for this transaction' }, { status: 409 })
    await touchActivity(handle)
    const previousTotal = await getVerifiedTotalNim(handle)
    const newTotal = verified ? await addVerifiedNim(handle, amountNIM) : previousTotal
    let milestone: MilestoneEvent | null = null
    const milestoneEvent = checkMilestone(previousTotal, newTotal, tip.anonymous ? 'Anonymous' : tip.senderAddress, getGoalMilestones(profile.goal?.targetNIM ?? 1000))
    if (milestoneEvent && await addMilestone(handle, milestoneEvent)) milestone = milestoneEvent
    await trackEvent(handle, 'TIP_COMPLETED')
    const claimToken = typeof body.claimToken === 'string' ? body.claimToken : ''
    if (claimToken) {
      const claim = await getClaim(claimToken)
      if (claim && claim.creatorHandle === handle && await markClaimClaimed(claim.token, txHash)) await trackEvent(handle, 'RETURNED_AFTER_INSTALL')
    }
    return NextResponse.json({ success: true, tip, milestone, pending: !verified })
  } catch (err) {
    console.error('Tip submission error:', err)
    return NextResponse.json({ error: 'Failed to submit tip' }, { status: 500 })
  }
}
