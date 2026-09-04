import { normalizeAddress } from './profile-auth'

export type VerifyResult = 'verified' | 'mismatch' | 'unavailable'
export type VerifiedTxDetails = { result: VerifyResult; senderAddress?: string }

const ADDR_FIELDS = ['toAddress', 'to', 'to_address', 'recipientAddress', 'recipient', 'receiver_address'] as const
const SENDER_FIELDS = ['senderAddress', 'sender_address', 'fromAddress', 'from', 'from_address', 'sender'] as const
const VALUE_FIELDS = ['value', 'amount', 'luna', 'lunaValue'] as const
const CONFIRMATION_FIELDS = ['confirmations', 'confirmationCount', 'numConfirmations'] as const
const BLOCK_HEIGHT_FIELDS = ['blockHeight', 'block_height', 'blockNumber', 'block_number'] as const
const BLOCK_HASH_FIELDS = ['blockHash', 'block_hash'] as const

/**
 * Only count transactions with explicit chain inclusion evidence. A matching
 * mempool payload is not enough: it can disappear before it funds the creator.
 * Explorer and node APIs use different names, so accept their common shapes.
 */
function hasConfirmedInclusion(tx: Record<string, unknown>): boolean {
  const status = tx.status ?? tx.state
  let statusConfirmed = false
  if (typeof status === 'string') {
    const normalized = status.toLowerCase()
    if (/(pending|mempool|unconfirmed)/.test(normalized)) return false
    statusConfirmed = /(confirmed|mined|included|finalized)/.test(normalized)
  }

  const confirmations = CONFIRMATION_FIELDS
    .map(field => tx[field])
    .find(value => value != null)
  if (confirmations != null) {
    const count = Number(confirmations)
    return Number.isFinite(count) && count >= 1
  }

  const height = BLOCK_HEIGHT_FIELDS
    .map(field => tx[field])
    .find(value => value != null)
  if (height != null) {
    const parsed = Number(height)
    if (Number.isFinite(parsed)) return parsed >= 0
  }

  const blockHash = BLOCK_HASH_FIELDS
    .map(field => tx[field])
    .find(value => typeof value === 'string' && value.length > 0)
  if (blockHash) return true

  const block = tx.block
  if (block && typeof block === 'object') {
    const blockRecord = block as Record<string, unknown>
    return blockRecord.height != null || blockRecord.number != null ||
      (typeof blockRecord.hash === 'string' && blockRecord.hash.length > 0)
  }

  return statusConfirmed || tx.inBlock === true || tx.isMined === true || tx.confirmed === true
}

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

function inspect(tx: Record<string, unknown>, recipientNorm: string, amountLuna: number) {
  const toAddrRaw = ADDR_FIELDS.map(f => tx[f]).find(value => typeof value === 'string' && value.length > 0) as string | undefined
  const rawValue = VALUE_FIELDS.map(f => tx[f]).find(v => v != null)
  if (!toAddrRaw || rawValue == null) return { result: 'unknown' as const }
  if (!hasConfirmedInclusion(tx)) return { result: 'unknown' as const }
  const value = Number(rawValue)
  if (!Number.isFinite(value)) return { result: 'unknown' as const }
  const sender = SENDER_FIELDS.map(f => tx[f]).find(Boolean)
  const senderAddress = sender ? normalizeAddress(String(sender)) : undefined
  const result = normalizeAddress(toAddrRaw) === recipientNorm && Math.abs(value - amountLuna) <= 1000 ? 'match' as const : 'mismatch' as const
  return { result, senderAddress }
}

export async function verifyTxDetails(txHash: string, recipient: string, amountLuna: number, attempts = 6): Promise<VerifiedTxDetails> {
  const recipientNorm = normalizeAddress(recipient)
  const rpcUrl = process.env.NIMIQ_RPC_URL
  for (let attempt = 0; attempt < attempts; attempt++) {
    const responses: unknown[] = []
    if (rpcUrl) {
      try {
        const resp = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'getTransactionByHash', params: [txHash], id: 1 }) })
        if (resp.ok) responses.push(await resp.json())
      } catch { }
    }
    try {
      const resp = await fetch(`https://v2.nimiqwatch.com/api/v1/transaction/${encodeURIComponent(txHash)}`, { headers: { 'User-Agent': 'TipWall/1.0' } })
      if (resp.ok) responses.push(await resp.json())
    } catch { }
    for (const data of responses) for (const tx of candidatesFrom(data)) {
      const checked = inspect(tx, recipientNorm, amountLuna)
      if (checked.result === 'match') return { result: 'verified', senderAddress: checked.senderAddress }
      if (checked.result === 'mismatch') return { result: 'mismatch' }
    }
    if (attempt < attempts - 1) await new Promise(r => setTimeout(r, Math.min(2000, 500 * (attempt + 1))))
  }
  return { result: 'unavailable' }
}

export async function verifyTx(txHash: string, recipient: string, amountLuna: number, attempts = 6): Promise<VerifyResult> {
  return (await verifyTxDetails(txHash, recipient, amountLuna, attempts)).result
}
