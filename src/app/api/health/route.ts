import { NextResponse } from 'next/server'
import { kv } from '@/lib/kv'
import { withinRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/logger'
import { validatePolygonAddress } from '@/lib/validate-profile'

export const dynamic = 'force-dynamic'

/**
 * Liveness check. Intentionally terse: no env values, URLs, or error internals
 * are exposed - this endpoint is public.
 */
export async function GET(request: Request) {
  const startedAt = Date.now()
  try {
    if (!await withinRateLimit(request, 'health-read', 60)) {
      return NextResponse.json({ status: 'RATE_LIMITED' }, { status: 429, headers: { 'Cache-Control': 'no-store' } })
    }
    await kv.set('health-check', 'ok', { ex: 10 })
    const result = await kv.get('health-check')
    if (result !== 'ok') {
      return NextResponse.json(
        { status: 'ERROR', latencyMs: Date.now() - startedAt },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    const rpcConfigured = Boolean(process.env.NIMIQ_RPC_URL)
    const polygonRpcConfigured = Boolean(process.env.POLYGON_RPC_URL)
    const serverUsdtToken = (process.env.USDT_POLYGON_TOKEN_ADDRESS || '').trim()
    const publicUsdtToken = (process.env.NEXT_PUBLIC_USDT_POLYGON_TOKEN_ADDRESS || '').trim()
    return NextResponse.json(
      {
        status: 'OK',
        latencyMs: Date.now() - startedAt,
        services: {
          kv: 'OK',
          nimiqRpcConfigured: rpcConfigured,
          polygonRpcConfigured,
          usdtServerTokenConfigured: Boolean(serverUsdtToken && !validatePolygonAddress(serverUsdtToken)),
          usdtPublicTokenConfigured: Boolean(publicUsdtToken && !validatePolygonAddress(publicUsdtToken)),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    logError('health_check_failed', error, { latencyMs: Date.now() - startedAt })
    return NextResponse.json(
      { status: 'ERROR', latencyMs: Date.now() - startedAt },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
