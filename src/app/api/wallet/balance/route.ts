import { NextRequest, NextResponse } from 'next/server'
import { isValidNimiqAddress, normalizeAddress } from '@/lib/profile-auth'
import { parseBalanceLuna } from '@/lib/nimiq-balance'
import { withinRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const FALLBACK_RPC = 'https://rpc.nimiqwatch.com'

function rpcCandidates(): string[] {
  return [process.env.NIMIQ_RPC_URL, FALLBACK_RPC]
    .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
}

/**
 * Read the current native NIM balance without mutating application state. A
 * missing account is a valid zero balance; upstream failures are reported as
 * unavailable so the client never blocks a payment based on stale data.
 */
export async function GET(request: NextRequest) {
  if (!await withinRateLimit(request, 'wallet-balance', 60)) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  }
  const rawAddress = request.nextUrl.searchParams.get('address') || ''
  const address = normalizeAddress(rawAddress)
  if (!isValidNimiqAddress(address)) {
    return NextResponse.json({ error: 'A valid Nimiq address is required' }, { status: 400 })
  }

  for (const url of rpcCandidates()) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'getAccountByAddress',
          params: [address],
          id: 1,
        }),
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) continue

      const payload = await response.json() as { result?: unknown; error?: unknown }
      if (payload.error) continue
      // Nodes commonly return null for an address with no account yet.
      const balanceLuna = payload.result === null ? 0 : parseBalanceLuna(payload)
      if (balanceLuna == null) continue

      return NextResponse.json(
        { address, balanceLuna, balanceNIM: balanceLuna / 100000 },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch {
      // Try the next configured/public relay.
    }
  }

  return NextResponse.json({ error: 'NIM balance is temporarily unavailable' }, { status: 503 })
}
