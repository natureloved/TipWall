import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

const KEY = 'tipwall:price:nimiq'
const TTL_MS = 10 * 60 * 1000

type PriceRow = { usd: number; eur: number; at: number }

/**
 * NIM fiat reference prices for the "≈" hints. Cached in KV for 10 minutes so
 * the whole deployment shares one CoinGecko call; on upstream failure we serve
 * the stale cache, and with none at all an empty object (clients hide then).
 */
export async function GET() {
  const cached = await kv.get<PriceRow>(KEY).catch(() => null)
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json({ usd: cached.usd, eur: cached.eur })
  }
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=nimiq&vs_currencies=usd,eur', {
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data = (await res.json()) as { nimiq?: { usd?: number; eur?: number } }
      const usd = Number(data?.nimiq?.usd)
      const eur = Number(data?.nimiq?.eur)
      if (Number.isFinite(usd) && Number.isFinite(eur) && usd > 0) {
        const row: PriceRow = { usd, eur, at: Date.now() }
        await kv.set(KEY, row, { px: TTL_MS }).catch(() => {})
        return NextResponse.json({ usd, eur })
      }
    }
  } catch {
    // fall through to stale/empty
  }
  if (cached) return NextResponse.json({ usd: cached.usd, eur: cached.eur })
  return NextResponse.json({})
}
