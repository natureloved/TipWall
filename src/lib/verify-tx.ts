// On-chain verification of a Nimiq tip transaction. Shared by the tip-submit
// route (multi-attempt, waits out indexer lag) and the read-time re-verification
// pass (single attempt, keeps reads fast).

import { normalizeAddress } from './profile-auth'

// Three-state so callers can tell "not this creator's tx" (reject) apart from
// "no indexer confirmed it in time" (accept as pending):
//   'verified'    – found on-chain, recipient + amount match
//   'mismatch'    – found on-chain, but recipient/amount do NOT match (forgery/error)
//   'unavailable' – RPC/explorer lag or downtime; couldn't confirm either way
export type VerifyResult = 'verified' | 'mismatch' | 'unavailable'

// Sources name these fields differently, so probe several.
const ADDR_FIELDS = ['toAddress', 'to', 'to_address', 'recipientAddress', 'recipient'] as const
const VALUE_FIELDS = ['value', 'amount', 'luna', 'lunaValue'] as const

// A response may wrap the tx at various depths (raw, JSON-RPC `result` /
// `result.data`, explorer envelope). Collect every plausible tx object.
function candidatesFrom(data: unknown): Record<string, unknown>[] {
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

function inspect(tx: Record<string, unknown>, recipientNorm: string, amountLuna: number): 'match' | 'mismatch' | 'unknown' {
  const toAddrRaw = ADDR_FIELDS.map(f => tx[f]).find(Boolean) as string | undefined
  const rawValue = VALUE_FIELDS.map(f => tx[f]).find(v => v != null)
  if (!toAddrRaw || rawValue == null) return 'unknown'
  const value = Number(rawValue)
  if (!Number.isFinite(value)) return 'unknown'
  const recipientMatch = normalizeAddress(toAddrRaw) === recipientNorm
  const amountMatch = value >= amountLuna - 1000 && value <= amountLuna + 1000
  return recipientMatch && amountMatch ? 'match' : 'mismatch'
}

/**
 * Verify a tip transaction against a recipient + expected amount (in luna).
 * @param attempts how many times to poll before giving up (submit waits out
 *   indexer lag with the default; read-time re-verification passes 1).
 */
export async function verifyTx(
  txHash: string,
  recipient: string,
  amountLuna: number,
  attempts = 6,
): Promise<VerifyResult> {
  const recipientNorm = normalizeAddress(recipient)
  const rpcUrl = process.env.NIMIQ_RPC_URL

  for (let attempt = 0; attempt < attempts; attempt++) {
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
        const result = inspect(tx, recipientNorm, amountLuna)
        if (result === 'match') return 'verified'
        // A resolved-but-wrong tx is definitive: this hash isn't a tip to us.
        if (result === 'mismatch') return 'mismatch'
      }
    }

    // Not indexed yet — back off and retry (new txs take a few seconds to appear).
    if (attempt < attempts - 1) {
      await new Promise(r => setTimeout(r, Math.min(2000, 500 * (attempt + 1))))
    }
  }

  return 'unavailable'
}
