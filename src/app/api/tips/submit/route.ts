import { NextRequest, NextResponse } from 'next/server'
import { getProfile, getTips, recordTipAtomically, addMilestone, markClaimClaimed, getClaim, trackEvent, checkRateLimit, getVerifiedTotalNim, initializeVerifiedTotal, addVerifiedNim, touchActivity, claimTipTelegramNotification, markTipTelegramNotified, releaseTipTelegramNotification } from '@/lib/kv'
import { Tip, MilestoneEvent, getGoalMilestones } from '@/lib/types'
import { checkMilestone } from '@/lib/milestones'
import { verifyTxDetails } from '@/lib/verify-tx'
import { verifyUsdtTxDetails } from '@/lib/verify-usdt'
import { getClientIp } from '@/lib/request'
import { logError } from '@/lib/logger'
import { sendTelegramTipNotification } from '@/lib/telegram'

const MAX_TIPS_PER_WINDOW = 5
const MAX_TIP_NIM = 100_000_000

function getRateLimitKey(req: NextRequest): string {
  return `tip:${getClientIp(req)}`
}

export async function POST(req: NextRequest) {
  const withinLimit = await checkRateLimit(getRateLimitKey(req), MAX_TIPS_PER_WINDOW, 60000)
  if (!withinLimit) return NextResponse.json({ error: 'Rate limit exceeded. Please wait before sending another tip.' }, { status: 429 })
  try {
    const body = await req.json() as Record<string, unknown>
    const rawHandle = String(body.handle || '')
    const txHash = String(body.txHash || '')
    const asset = body.asset === 'USDT' ? 'USDT' : 'NIM'
    const amountNIM = Number(body.amountNIM)
    const amountUSDT = Number(body.amountUSDT)
    if (!rawHandle || !txHash) return NextResponse.json({ error: 'missing fields' }, { status: 400 })
    if (asset === 'NIM' && (!Number.isFinite(amountNIM) || amountNIM < 1 || amountNIM > MAX_TIP_NIM || Math.round(amountNIM * 100000) !== amountNIM * 100000)) return NextResponse.json({ error: 'invalid amount' }, { status: 400 })
    if (asset === 'USDT' && (!Number.isFinite(amountUSDT) || amountUSDT < 0.01 || amountUSDT > 1_000_000_000 || Math.round(amountUSDT * 1_000_000) !== amountUSDT * 1_000_000)) return NextResponse.json({ error: 'invalid USDT amount' }, { status: 400 })
    if (txHash.length < 32 || txHash.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(txHash)) return NextResponse.json({ error: 'invalid payment reference' }, { status: 400 })
    const handle = rawHandle.toLowerCase().replace(/[^a-z0-9_-]/g, '')
    const profile = await getProfile(handle)
    if (!profile) return NextResponse.json({ error: 'creator not found' }, { status: 404 })
    const existing = await getTips(handle)
    if (existing.some(t => t.txHash === txHash)) return NextResponse.json({ error: 'tip already recorded for this transaction' }, { status: 409 })
    if (asset === 'USDT' && !profile.usdtPolygonAddress) return NextResponse.json({ error: 'USDT tips are not enabled for this wall' }, { status: 400 })
    const verification = asset === 'USDT'
      ? await verifyUsdtTxDetails(txHash, profile.usdtPolygonAddress || '', amountUSDT)
      : await verifyTxDetails(txHash, profile.walletAddress, Math.round(amountNIM * 100000))
    if (verification.result === 'mismatch') return NextResponse.json({ error: 'transaction does not match this tip' }, { status: 402 })
    const verified = verification.result === 'verified'
    // Read the pre-tip total before appending the record. Legacy walls are
    // initialized here, on the mutation path, so GETs remain pure.
    const previousTotal = await getVerifiedTotalNim(handle)
    if (verified) await initializeVerifiedTotal(handle, previousTotal)
    const anonymous = body.anonymous === true
    // Self-reported display name is garnish, never identity: capped, trimmed,
    // and dropped entirely for anonymous tips.
    const senderName = anonymous ? undefined : (typeof body.senderName === 'string' ? body.senderName.trim().slice(0, 24) : '') || undefined
    const tip: Tip = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      handle,
      senderAddress: verification.senderAddress || '',
      senderName,
      amountNIM: asset === 'NIM' ? amountNIM : 0,
      ...(asset === 'USDT' ? { asset: 'USDT' as const, amountUSDT } : {}),
      txHash,
      verified,
      timestamp: Date.now(),
      reason: ['helpful_content', 'open_source', 'tutorial', 'great_idea', 'just_support'].includes(String(body.reason || '')) ? body.reason as Tip['reason'] : undefined,
      message: typeof body.message === 'string' ? body.message.slice(0, 64) : '',
      anonymous,
      ...(verified ? {} : { verificationAttempts: 0, nextVerificationAt: Date.now() + 20_000 }),
    }
    if (!await recordTipAtomically(handle, txHash, tip)) return NextResponse.json({ error: 'tip already recorded for this transaction' }, { status: 409 })
    await touchActivity(handle)
    // Owner opt-in notification. Await the outbound request so serverless
    // runtimes cannot terminate before Telegram receives it. A notification
    // failure never rolls back an already-recorded payment.
    if (verified && profile.notifyTelegram) {
      const claimedAt = Date.now()
      try {
        if (await claimTipTelegramNotification(handle, tip.id, claimedAt)) {
          const sent = await sendTelegramTipNotification(profile, tip)
          if (sent) await markTipTelegramNotified(handle, tip.id)
          else await releaseTipTelegramNotification(handle, tip.id, claimedAt)
        }
      } catch (error) {
        await releaseTipTelegramNotification(handle, tip.id, claimedAt).catch(() => {})
        logError('telegram_notification_failed', error, { handle })
      }
    }
    const newTotal = verified && asset === 'NIM' ? await addVerifiedNim(handle, amountNIM) : previousTotal
    let milestone: MilestoneEvent | null = null
    const milestoneEvent = asset === 'NIM' ? checkMilestone(previousTotal, newTotal, tip.anonymous ? 'Anonymous' : tip.senderAddress, getGoalMilestones(profile.goal?.targetNIM ?? 1000)) : null
    if (milestoneEvent && await addMilestone(handle, milestoneEvent)) milestone = milestoneEvent
    // A completed funnel event means the payment is confirmed on-chain. A
    // pending submission remains visible as pending, but must not inflate
    // conversion or social-proof totals until reverification promotes it.
    if (verified) await trackEvent(handle, 'TIP_COMPLETED')
    const claimToken = typeof body.claimToken === 'string' ? body.claimToken : ''
    if (claimToken) {
      const claim = await getClaim(claimToken)
      if (claim && claim.creatorHandle === handle && await markClaimClaimed(claim.token, txHash)) await trackEvent(handle, 'RETURNED_AFTER_INSTALL')
    }
    return NextResponse.json({ success: true, tip, milestone, pending: !verified })
  } catch (err) {
    logError('tip_submission_failed', err)
    return NextResponse.json({ error: 'Failed to submit tip' }, { status: 500 })
  }
}
