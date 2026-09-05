import { NextRequest, NextResponse } from 'next/server'
import { isValidNimiqAddress, normalizeAddress } from '@/lib/profile-auth'
import { parseBalanceLuna } from '@/lib/nimiq-balance'
import { withinRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Keep the documented Nimiq node first, then use the community relay as a
// secondary option. A configured URL still takes precedence over both.
const FALLBACK_RPCS = ['https://api.nimiq.com', 'https://rpc.nimiqwatch.com']
const FALLBACK_ACCOUNT_APIS = ['https://v2.nimiqwatch.com/api/v1/account']

function rpcCandidates(): string[] {
  return [process.env.NIMIQ_RPC_URL, ...FALLBACK_RPCS]
    .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
}

async function readExplorerBalance(address: string): Promise<number | null> {
  for (const baseUrl of FALLBACK_ACCOUNT_APIS) {
    try {
      const response = await fetch(`${baseUrl}/${encodeURIComponent(address)}`, {
        headers: { 'User-Agent': 'TipWall/1.0' },
        signal: AbortSignal.timeout(3000),
      })
      if (!response.ok) continue
      const payload = await response.json()
      const balanceLuna = parseBalanceLuna(payload)
      if (balanceLuna != null) return balanceLuna
    } catch {
      // Try the next account API, if one is configured later.
    }
  }
  return null
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

  // Keep an explicit zero as a last resort. Some relays can temporarily
  // report zero for an account while another healthy node already has the
  // funded state; prefer a positive result from any later candidate.
  let confirmedZero = false
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
      // A null result means this relay did not resolve the account. It is not
      // safe to turn that into zero: a relay can return null for an unsupported
      // method, an address/network mismatch, or a stale index. Only an
      // explicit balance field is authoritative; otherwise try the next node.
      if (payload.result == null) continue
      const balanceLuna = parseBalanceLuna(payload)
      if (balanceLuna == null) continue

      if (balanceLuna === 0) {
        confirmedZero = true
        continue
      }

      return NextResponse.json(
        { address, balanceLuna, balanceNIM: balanceLuna / 100000 },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch {
      // Try the next configured/public relay.
    }
  }

  // Some public RPC relays answer with an explicit zero while their account
  // index is stale. Use the explorer's account endpoint before presenting a
  // zero to the supporter; this is read-only and only runs after RPC misses.
  const explorerBalance = await readExplorerBalance(address)
  if (explorerBalance != null && explorerBalance > 0) {
    return NextResponse.json(
      { address, balanceLuna: explorerBalance, balanceNIM: explorerBalance / 100000 },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  if (confirmedZero) {
    return NextResponse.json(
      { address, balanceLuna: 0, balanceNIM: 0 },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return NextResponse.json({ error: 'NIM balance is temporarily unavailable' }, { status: 503 })
}
