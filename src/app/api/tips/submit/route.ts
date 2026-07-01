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

// Three-state so the caller can tell "not this creator's tx" (reject) apart
// from "no indexer confirmed it in time" (accept as pending):
//   'verified'    – found on-chain, recipient + amount match
//   'mismatch'    – found on-chain, but recipient/amount do NOT match (forgery/error)
//   'unavailable' – RPC/explorer lag or downtime; couldn't confirm either way
type VerifyResult = 'verified' | 'mismatch' | 'unavailable'

async function verifyTx(txHash: string, recipient: string, amountLuna: number): Promise<VerifyResult> {
  const recipientNorm = normalizeAddress(recipient)

  // Sources name these fields differently, so probe several.
  const addrFields = ['toAddress', 'to', 'to_address', 'recipientAddress', 'recipient'] as const
  const valueFields = ['value', 'amount', 'luna', 'lunaValue'] as const

  // A response may wrap the tx at various depths (raw, JSON-RPC `result` /
  // `result.data`, explorer envelope). Collect every plausible tx object.
  const candidatesFrom = (data: unknown): Record<string, unknown>[] => {
    const out: Record<string, unknown>[] = []
    const push = (v: unknown) => { if (v && typeof v === 'object') out.push(v as Record<string, unknown>) }
    const d = data as Record<string, unknown> | null
    push(d)
    if (d) {
      push(d.transaction); push(d.result); push(d.data)
      const r = d.result as Record<string, unknown> | undefined
      if (r) { push(r.data); push(r.transaction) }
    }
    return out
  }

  const inspect = (tx: Record<string, unknown>): 'match' | 'mismatch' | 'unknown' => {
    const toAddrRaw = addrFields.map(f => tx[f]).find(Boolean) as string | undefined
    const rawValue = valueFields.map(f => tx[f]).find(v => v != null)
    if (!toAddrRaw || rawValue == null) return 'unknown'
    const value = Number(rawValue)
    if (!Number.isFinite(value)) return 'unknown'
    const recipientMatch = normalizeAddress(toAddrRaw) === recipientNorm
    const amountMatch = value >= amountLuna - 1000 && value <= amountLuna + 1000
    return recipientMatch && amountMatch ? 'match' : 'mismatch'
  }

  const rpcUrl = process.env.NIMIQ_RPC_URL

  for (let attempt = 0; attempt < 6; attempt++) {
    const responses: unknown[] = []

    // 1. Nimiq PoS node — JSON-RPC `getTransactionByHash` (POST), not a REST GET.
    if (rpcUrl) {
      try {
        const resp = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'getTransactionByHash', params: [txHash], id: 1 }),
        })
        if (resp.ok) responses.push(await resp.json())
      } catch { }
    }

    // 2. nimiq.watch explorer REST fallback.
    try {
      const resp = await fetch(`https://v2.nimiqwatch.com/api/v1/transaction/${txHash}`, {
        headers: { 'User-Agent': 'TipWall/1.0' },
      })
      if (resp.ok) responses.push(await resp.json())
    } catch { }

    for (const data of responses) {
      for (const tx of candidatesFrom(data)) {
        const result = inspect(tx)
        if (result === 'match') return 'verified'
        // A resolved-but-wrong tx is definitive: this hash isn't a tip to us.
        if (result === 'mismatch') return 'mismatch'
      }
    }

    // Not indexed yet — back off and retry (new txs take a few seconds to appear).
    if (attempt < 5) {
      await new Promise(r => setTimeout(r, Math.min(2000, 500 * (attempt + 1))))
    }
  }

  return 'unavailable'
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

    // Best-effort on-chain verification.
    const verifyResult = await verifyTx(body.txHash, profile.walletAddress, body.amountNIM * 100000)

    // Found on-chain but going to the wrong recipient / wrong amount: this hash
    // does not fund a tip to this creator. Reject it as a forgery or mistake.
    if (verifyResult === 'mismatch') {
      return NextResponse.json({ error: 'transaction does not match this tip' }, { status: 402 })
    }

    // 'verified' → confirmed on-chain. 'unavailable' → indexer lag/downtime, so
    // record it as unverified ("Pending") rather than dropping it: the sender's
    // wallet already executed the transaction, so a real tip is never lost.
    const verified = verifyResult === 'verified'

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

    return NextResponse.json({ success: true, tip, milestone, pending: !verified })
  } catch (err: any) {
    console.error('Tip submission error:', err)
    return NextResponse.json({ error: err.message || 'Failed to submit tip' }, { status: 500 })
  }
}
