import { NextRequest, NextResponse } from 'next/server'
import { getProfileByWallet } from '@/lib/kv'
import { normalizeAddress, type ProfileAuthProof } from '@/lib/profile-auth'
import { verifyProfileAuth } from '@/lib/verify-signature'

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address')
    const walletStr = normalizeAddress(String(address || ''))
    if (!walletStr.startsWith('NQ')) {
      return NextResponse.json({ error: 'Invalid Nimiq wallet address' }, { status: 400 })
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

    const profile = await getProfileByWallet(walletStr)
    if (!profile) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    return NextResponse.json(profile)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to load profile'
    console.error('Profile by wallet error:', errorMsg)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
