import { NextResponse } from 'next/server'
import { kv } from '@/lib/kv'
import { withinRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const KEY = 'tipwall:price:nimiq:v2'
const TTL_MS = 10 * 60 * 1000

// CoinGecko carries a dead legacy entry under id "nimiq" (no live markets,
// stale price ~87x off). The live listing is "nimiq-2".
const COINGECKO_ID = 'nimiq-2'
const CMC_ID = 2916

type PriceRow = { usd: number; eur: number; at: number }

type GeckoQuote = { usd?: number; eur?: number; usd_market_cap?: number; usd_24h_change?: number | null }
type CmcResponse = { data?: { quotes?: Record<string, { price?: number }> } }

async function fetchGecko(): Promise<{ usd: number; eur: number; live: boolean } | null> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_ID}&vs_currencies=usd,eur&include_market_cap=true&include_24hr_change=true`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, GeckoQuote | undefined>
    const q = data[COINGECKO_ID]
    const usd = Number(q?.usd)
    const eur = Number(q?.eur)
    if (!Number.isFinite(usd) || !Number.isFinite(eur) || usd <= 0) return null
    // A live listing always reports a 24h change; the dead legacy entry had
    // null there plus a ~$300k "market cap" - treat such entries as stale.
    const live = Number.isFinite(Number(q?.usd_24h_change)) && Number(q?.usd_market_cap) > 1_000_000
    return { usd, eur, live }
  } catch {
    return null
  }
}

async function fetchCmcUsd(): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.coinmarketcap.com/data-api/v3/cryptocurrency/quote/latest?id=${CMC_ID}&convert=USD`,
      { signal: AbortSignal.timeout(5000), headers: { accept: 'application/json' } },
    )
    if (!res.ok) return null
    const data = (await res.json()) as CmcResponse
    const quotes = data?.data?.quotes
    if (!quotes) return null
    const usd = Number(Object.values(quotes)[0]?.price)
    return Number.isFinite(usd) && usd > 0 ? usd : null
  } catch {
    return null
  }
}

async function fetchEurUsdRate(): Promise<number | null> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=eur&vs_currencies=usd', {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { eur?: { usd?: number } }
    const rate = Number(data?.eur?.usd)
    return Number.isFinite(rate) && rate > 0 ? rate : null
  } catch {
    return null
  }
}

/**
 * NIM fiat reference prices for the "≈" hints. Cached in KV for 10 minutes so
 * the whole deployment shares one upstream call; on upstream failure we serve
 * the stale cache, and with none at all an empty object (clients hide then).
 * CoinGecko is primary; CoinMarketCap cross-checks it, and when they diverge
 * beyond 25% we trust CMC (with EUR converted at the live fiat rate).
 */
export async function GET(request: Request) {
  if (!await withinRateLimit(request, 'price-read', 60)) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  }
  const cached = await kv.get<PriceRow>(KEY).catch(() => null)
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json({ usd: cached.usd, eur: cached.eur })
  }

  const [gecko, cmcUsd] = await Promise.all([fetchGecko(), fetchCmcUsd()])

  let row: PriceRow | null = null
  if (gecko && gecko.live && cmcUsd) {
    const ratio = gecko.usd / cmcUsd
    if (ratio >= 0.75 && ratio <= 1.25) {
      row = { usd: gecko.usd, eur: gecko.eur, at: Date.now() }
    }
  }
  if (!row && cmcUsd) {
    // Sources diverge (or CoinGecko entry looks dead): trust CoinMarketCap.
    const eurUsd = await fetchEurUsdRate()
    row = { usd: cmcUsd, eur: eurUsd ? cmcUsd / eurUsd : cmcUsd, at: Date.now() }
  }
  if (!row && gecko && gecko.live) {
    row = { usd: gecko.usd, eur: gecko.eur, at: Date.now() }
  }

  if (row) {
    await kv.set(KEY, row, { px: TTL_MS }).catch(() => {})
    return NextResponse.json({ usd: row.usd, eur: row.eur })
  }
  if (cached) return NextResponse.json({ usd: cached.usd, eur: cached.eur })
  return NextResponse.json({})
}
