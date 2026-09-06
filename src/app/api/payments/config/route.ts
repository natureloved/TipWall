import { NextResponse } from 'next/server'
import { validatePolygonAddress } from '@/lib/validate-profile'

export const dynamic = 'force-dynamic'

/**
 * The Polygon USDT contract address is public chain metadata, not a secret.
 * Prefer the server-side setting so a deployment does not hide the supporter
 * payment selector just because the NEXT_PUBLIC mirror was omitted.
 */
export async function GET() {
  const tokenAddress = (
    process.env.USDT_POLYGON_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_USDT_POLYGON_TOKEN_ADDRESS ||
    ''
  ).trim()

  return NextResponse.json(
    { tokenAddress: tokenAddress && !validatePolygonAddress(tokenAddress) ? tokenAddress : null },
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } },
  )
}
