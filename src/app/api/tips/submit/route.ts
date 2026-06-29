import { NextRequest, NextResponse } from 'next/server'
import { getProfile, getTips, addTip, upsertSupporter, addMilestone, markClaimClaimed, trackEvent } from '@/lib/kv'
import { Tip, MilestoneEvent } from '@/lib/types'
import { checkMilestone } from '@/lib/milestones'
import { normalizeAddress } from '@/lib/profile-auth'

const RATE_LIMIT_WINDOW = 60000
const MAX_TIPS_PER_WINDOW = 5

const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function getRateLimitKey(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const deviceId = req.headers.get('x-device-id') || 'unknown'
  return `${ip}:${deviceId}`
}

function checkRateLimitSync(req: NextRequest): boolean {
  const key = getRateLimitKey(req)
  const now = Date.now()
  const record = rateLimitStore.get(key)
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }
  
  if (record.count >= MAX_TIPS_PER_WINDOW) {
    return false
  }
  
  record.count++
  return true
}

async function verifyTx(txHash: string, recipient: string, amountLuna: number): Promise<boolean> {
  const recipientNorm = normalizeAddress(recipient)

  const endpoints = [
    `https://api.nimiq.com/transaction/${txHash}`,
    `https://api.nimiq.com/transactions/${txHash}`,
    `https://nimiq.watch/api/tx/${txHash}`,
    `https://explorer.nimiq.com/api/v1/transactions/${txHash}`,
  ]

  const addrFields = ['toAddress', 'to', 'recipientAddress', 'recipient'] as const
  const valueFields = ['value', 'amount', 'luna', 'lunaValue'] as const

  for (let attempt = 0; attempt < 6; attempt++) {
    for (const endpoint of endpoints) {
      try {
        const resp = await fetch(endpoint, { headers: { 'User-Agent': 'TipWall/1.0' } })
        if (!resp.ok) continue
        const data = await resp.json()

        const tx = data.transaction || data.result || data.data || data
        if (!tx || typeof tx !== 'object') continue

        const toAddrRaw = addrFields.map(f => (tx as Record<string, unknown>)[f]).find(Boolean) as string | undefined
        const rawValue = valueFields.map(f => (tx as Record<string, unknown>)[f]).find(v => v != null)

        if (!toAddrRaw || rawValue == null) continue
        const value = Number(rawValue)
        if (!Number.isFinite(value)) continue

        if (normalizeAddress(toAddrRaw) === recipientNorm && value >= amountLuna - 1000 && value <= amountLuna + 1000) {
          return true
        }
      } catch { }
    }

    if (attempt < 5) {
      await new Promise(r => setTimeout(r, Math.min(2000, 500 * (attempt + 1))))
    }
  }

  return false
}

export async function POST(req: NextRequest) {
  if (!checkRateLimitSync(req)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait before sending another tip.' }, { status: 429 })
  }

  try {
    const body = (await req.json()) as Partial<Tip> & { handle?: string; txHash?: string }
    if (!body.handle || !body.senderAddress || !body.txHash || typeof body.amountNIM !== 'number') {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 })
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

    // Only accept tips we can verify on-chain, so totals/walls can't be forged.
    const verified = await verifyTx(body.txHash, profile.walletAddress, body.amountNIM * 100000)
    if (!verified) {
      return NextResponse.json({ error: 'transaction could not be verified on-chain' }, { status: 402 })
    }

    const previousTotal = existing.reduce((sum, t) => sum + (t.amountNIM || 0), 0)
    const newTotal = previousTotal + body.amountNIM

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
    await upsertSupporter(handle, { senderAddress: tip.senderAddress, amountNIM: tip.amountNIM, timestamp: tip.timestamp })

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

    return NextResponse.json({ success: true, tip, milestone })
  } catch (err: any) {
    console.error('Tip submission error:', err)
    return NextResponse.json({ error: err.message || 'Failed to submit tip' }, { status: 500 })
  }
}
