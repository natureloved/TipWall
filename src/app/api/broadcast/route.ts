import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/kv'
import { getClientIp } from '@/lib/request'

const MAX_BROADCASTS_PER_WINDOW = 10

// Community-run public mainnet RPC (listed at github.com/nimiq/awesome). Used
// when NIMIQ_RPC_URL is unset or unreachable so the Hub desktop path always
// has a working relay.
const FALLBACK_RPCS = ['https://rpc.nimiqwatch.com']

function getRateLimitKey(req: NextRequest): string {
  return `broadcast:${getClientIp(req)}`
}

function isValidSerializedTx(tx: unknown): tx is string {
  // Hex, at least a minimal basic transaction (~138 bytes), capped to keep
  // the relay payload sane.
  return typeof tx === 'string' && /^[0-9a-f]{200,20000}$/i.test(tx)
}

export async function POST(req: NextRequest) {
  const withinLimit = await checkRateLimit(getRateLimitKey(req), MAX_BROADCASTS_PER_WINDOW, 60000)
  if (!withinLimit) return NextResponse.json({ error: 'Rate limit exceeded. Please wait a moment before trying again.' }, { status: 429 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  const serializedTx = body.serializedTx
  if (!isValidSerializedTx(serializedTx)) return NextResponse.json({ error: 'invalid transaction payload' }, { status: 400 })

  const candidates = [process.env.NIMIQ_RPC_URL, ...FALLBACK_RPCS]
    .filter((u, i, a): u is string => !!u && a.indexOf(u) === i)

  let lastError = ''
  for (const url of candidates) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'sendRawTransaction', params: [serializedTx], id: 1 }),
        signal: AbortSignal.timeout(8000),
      })
      if (!resp.ok) continue
      const json = await resp.json() as { result?: unknown; error?: { code?: number; message?: string } | string }
      if (typeof json.result === 'string' && json.result) {
        return NextResponse.json({ hash: json.result })
      }
      const message = typeof json.error === 'object' ? json.error?.message : typeof json.error === 'string' ? json.error : ''
      // The node itself rejected the transaction - other nodes would reject it
      // the same way, so surface it instead of hopping relays.
      if (message && /known|expired|invalid|signature|verif|insufficient/i.test(message)) {
        if (/known/i.test(message)) return NextResponse.json({ hash: null, alreadyKnown: true })
        return NextResponse.json({ error: message }, { status: 400 })
      }
      lastError = message || lastError
    } catch {
      // Node unreachable or timed out - try the next candidate.
    }
  }
  return NextResponse.json(
    { error: lastError || 'Could not reach the Nimiq network. Please try again in a moment.' },
    { status: 502 },
  )
}
