import { validatePolygonAddress } from './validate-profile'
import { usdtToBaseUnits } from './usdt'

export type VerifyUsdtResult = 'verified' | 'mismatch' | 'unavailable'
export type VerifiedUsdtDetails = { result: VerifyUsdtResult; senderAddress?: string }

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a9df523b3ef'

function rpcConfig(): { url: string; token: string } | null {
  const url = (process.env.POLYGON_RPC_URL || '').trim()
  const token = (process.env.USDT_POLYGON_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_USDT_POLYGON_TOKEN_ADDRESS || '').trim()
  if (!url || validatePolygonAddress(token)) return null
  return { url, token: token.toLowerCase() }
}

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error('Polygon RPC unavailable')
  const json = await response.json()
  if (json?.error) throw new Error(String(json.error.message || 'Polygon RPC error'))
  return json?.result
}

function topicAddress(topic: unknown): string {
  const value = String(topic || '')
  return value.startsWith('0x') && value.length >= 42 ? `0x${value.slice(-40)}`.toLowerCase() : ''
}

/** Verify a Polygon USDT transfer is mined, successful, and exact. */
export async function verifyUsdtTxDetails(txHash: string, recipient: string, amountUSDT: number, attempts = 3): Promise<VerifiedUsdtDetails> {
  const config = rpcConfig()
  if (!config || validatePolygonAddress(recipient)) return { result: 'unavailable' }
  const expectedRecipient = recipient.toLowerCase()
  let expected: bigint
  try { expected = usdtToBaseUnits(amountUSDT) } catch { return { result: 'mismatch' } }

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const [rawTx, rawReceipt, rawLatest] = await Promise.all([
        rpc(config.url, 'eth_getTransactionByHash', [txHash]),
        rpc(config.url, 'eth_getTransactionReceipt', [txHash]),
        rpc(config.url, 'eth_blockNumber', []),
      ])
      const tx = rawTx && typeof rawTx === 'object' ? rawTx as Record<string, unknown> : null
      const receipt = rawReceipt && typeof rawReceipt === 'object' ? rawReceipt as { status?: unknown; blockNumber?: unknown; logs?: unknown[] } : null
      const latest = rawLatest
      if (!tx || !receipt) {
        if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
        continue
      }
      if (String(receipt.status || '').toLowerCase() !== '0x1' || !receipt.blockNumber) return { result: 'unavailable' }
      const depth = Number.parseInt(String(latest || '0'), 16) - Number.parseInt(String(receipt.blockNumber), 16) + 1
      if (!Number.isFinite(depth) || depth < 1) return { result: 'unavailable' }
      if (String(tx.to || '').toLowerCase() !== config.token) return { result: 'mismatch' }

      const log = (Array.isArray(receipt.logs) ? receipt.logs : []).map(entry => entry && typeof entry === 'object' ? entry as { address?: unknown; topics?: unknown[]; data?: unknown } : null).find(entry =>
        entry && String(entry.address || '').toLowerCase() === config.token &&
        String(entry.topics?.[0] || '').toLowerCase() === TRANSFER_TOPIC &&
        topicAddress(entry.topics?.[2]) === expectedRecipient,
      )
      if (!log) return { result: 'mismatch' }
      const actual = BigInt(String(log.data || '0x0'))
      if (actual !== expected) return { result: 'mismatch' }
      return { result: 'verified', senderAddress: topicAddress(log.topics?.[1]) || String(tx.from || '') }
    } catch {
      if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }
  return { result: 'unavailable' }
}
