import { NextRequest, NextResponse } from 'next/server'
import { getProfile, checkRateLimit } from '@/lib/kv'
import { normalizeHandle, normalizeAddress } from '@/lib/profile-auth'
import { messageHasNonce } from '@/lib/pay-request'

/**
 * Poll for an incoming transaction to a creator's wallet, sent AFTER the QR was
 * shown, for the expected amount. Used by the scan-to-pay flow.
 *
 * Matching strategy (resilient): recipient + amount + freshness are REQUIRED.
 * The attribution nonce is only a preferred tiebreaker — Nimiq Pay's scanner
 * may or may not carry the message field into on-chain extra_data, so we must
 * not depend on it, or detection would never succeed.
 *
 * Primary source: Nimiq PoS RPC (getTransactionsByAddress). Fallback: nimiqwatch.
 *
 * GET /api/tips/detect?handle=&nonce=&amountNIM=&since=<epochMs>
 * Returns { found:false } or { found:true, txHash, senderAddress, amountNIM }.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const handle = normalizeHandle(searchParams.get('handle') || '')
  const nonce = (searchParams.get('nonce') || '').trim()
  const amountNIM = Number(searchParams.get('amountNIM'))
  // Only consider txs at/after this time (ms). Guards against matching an old
  // identical-amount tip. Default: 15 min ago, to tolerate clock skew.
  const since = Number(searchParams.get('since')) || Date.now() - 15 * 60_000

  const forwarded = req.headers.get('x-forwarded-for')
  const ip = (forwarded ? forwarded.split(',')[0].trim() : '') || req.headers.get('x-real-ip') || 'unknown'
  if (!(await checkRateLimit(`detect:${ip}:${handle}`, 30, 60_000))) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  }

  if (!handle || !Number.isFinite(amountNIM) || amountNIM < 1 || amountNIM > 100_000_000 || !Number.isFinite(since) || since < Date.now() - 60 * 60_000 || since > Date.now() + 60_000) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 })
  }

  const profile = await getProfile(handle)
  if (!profile) return NextResponse.json({ error: 'creator not found' }, { status: 404 })

  const recipientNorm = normalizeAddress(profile.walletAddress)
  const amountLuna = Math.round(amountNIM * 100_000)
  const rpcUrl = process.env.NIMIQ_RPC_URL

  const txs: Record<string, unknown>[] = []

  // 1. Nimiq RPC — getTransactionsByAddress
  if (rpcUrl) {
    try {
      const resp = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', method: 'getTransactionsByAddress', params: [recipientNorm, 25], id: 1,
        }),
        next: { revalidate: 0 },
      })
      if (resp.ok) {
        const json = await resp.json()
        const result = json?.result?.data ?? json?.result ?? []
        if (Array.isArray(result)) txs.push(...result)
      }
    } catch { /* fall through */ }
  }

  // 2. nimiqwatch explorer fallback
  if (txs.length === 0) {
    try {
      const addrStripped = recipientNorm.replace(/ /g, '')
      const resp = await fetch(
        `https://v2.nimiqwatch.com/api/v1/account-transactions/${encodeURIComponent(addrStripped)}/1`,
        { headers: { 'User-Agent': 'TipWall/1.0' }, next: { revalidate: 0 } },
      )
      if (resp.ok) {
        const json = await resp.json()
        const list = Array.isArray(json) ? json
          : Array.isArray(json?.transactions) ? json.transactions
          : Array.isArray(json?.data) ? json.data : []
        txs.push(...list)
      }
    } catch { /* explorer down */ }
  }

  // Read a tx timestamp in ms across the various shapes (RPC secs, explorer ms/iso)
  const txTimeMs = (tx: Record<string, unknown>): number => {
    const raw = tx.timestamp ?? tx.time ?? tx.date ?? tx.blockTime ?? 0
    if (typeof raw === 'number') return raw < 1e12 ? raw * 1000 : raw // secs → ms
    const parsed = Date.parse(String(raw))
    return Number.isFinite(parsed) ? parsed : 0
  }

  const decodeMsg = (raw: unknown): string => {
    if (typeof raw !== 'string' || !raw) return ''
    if (/^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0) {
      try { return Buffer.from(raw, 'hex').toString('utf8') } catch { return raw }
    }
    return raw
  }

  // Gather all candidates that match recipient + amount + freshness.
  const candidates = txs
    .map((tx) => {
      const to = normalizeAddress(String(tx.receiver_address ?? tx.toAddress ?? tx.to ?? tx.to_address ?? tx.recipient ?? tx.recipientAddress ?? ''))
      const value = Number(tx.value ?? tx.amount ?? tx.luna ?? 0)
      const msg = decodeMsg(tx.data ?? tx.message ?? tx.extraData ?? tx.extra_data)
      const sender = String(tx.sender_address ?? tx.fromAddress ?? tx.from ?? tx.from_address ?? tx.senderAddress ?? tx.sender ?? '')
      const hash = String(tx.hash ?? tx.transactionHash ?? tx.id ?? '')
      return { to, value, msg, sender, hash, time: txTimeMs(tx) }
    })
    .filter((c) =>
      c.hash &&
      c.to === recipientNorm &&
      Math.abs(c.value - amountLuna) <= 1000 &&
      (c.time === 0 || c.time >= since - 60_000), // allow 1 min skew
    )

  if (candidates.length === 0) return NextResponse.json({ found: false })

  // Prefer a nonce match if the message survived; else take the most recent.
  const nonceMatch = nonce ? candidates.find((c) => messageHasNonce(c.msg, nonce)) : undefined
  if (nonce && !nonceMatch) return NextResponse.json({ found: false })
  const best = nonceMatch || candidates.sort((a, b) => b.time - a.time)[0]

  return NextResponse.json({
    found: true,
    txHash: best.hash,
    senderAddress: best.sender,
    amountNIM,
  })
}
