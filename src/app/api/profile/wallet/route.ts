import { NextRequest, NextResponse } from 'next/server'
import { getProfilesByWallet } from '@/lib/kv'
import { normalizeAddress, nimiqAddressError, type ProfileAuthProof } from '@/lib/profile-auth'
import { verifyProfileAuth } from '@/lib/verify-signature'
import { withinRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (!await withinRateLimit(request, 'profile-wallet', 30)) {
      return NextResponse.json({ error: 'rate limited' }, { status: 429 })
    }
    const address = request.nextUrl.searchParams.get('address')
    const walletStr = normalizeAddress(String(address || ''))
    const walletError = nimiqAddressError(walletStr)
    if (walletError) {
      return NextResponse.json({ error: walletError }, { status: 400 })
    }

    const authHeader = request.headers.get('x-tipwall-auth')
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing wallet signature' }, { status: 401 })
    }

    let proof: ProfileAuthProof
    try {
      proof = JSON.parse(Buffer.from(authHeader, 'base64').toString('utf-8'))
    } catch {
      return NextResponse.json({ error: 'Invalid auth header' }, { status: 400 })
    }

    if (proof.action !== 'view') {
      return NextResponse.json({ error: 'Invalid authorization action' }, { status: 400 })
    }
    if (normalizeAddress(String(proof.walletAddress || '')) !== walletStr) {
      return NextResponse.json({ error: 'Signature wallet mismatch' }, { status: 400 })
    }

    const verdict = verifyProfileAuth(proof)
    if (!verdict.ok || verdict.signerAddress !== walletStr) {
      return NextResponse.json({ error: verdict.error || 'Invalid wallet signature' }, { status: 401 })
    }

    const profiles = await getProfilesByWallet(walletStr)
    if (!profiles.length) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    return NextResponse.json({ profiles })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to load profile'
    logError('profile_wallet_lookup_failed', err, { errorMsg })
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
