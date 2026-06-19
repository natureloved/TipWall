import { NextRequest, NextResponse } from 'next/server'
import { getProfile, setProfile, consumeAuthNonce } from '@/lib/kv'
import { type CreatorProfile } from '@/lib/types'
import { normalizeAddress, normalizeHandle, PROFILE_AUTH_TTL_MS, type ProfileAuthProof } from '@/lib/profile-auth'
import { verifyProfileAuth } from '@/lib/verify-signature'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      handle,
      displayName,
      bio = '',
      contentUrl = '',
      walletAddress,
      goal,
      achievement,
      auth,
    } = body as Record<string, unknown>

    const handleStr = normalizeHandle(String(handle || ''))
    if (!handleStr || handleStr.length < 3) {
      return NextResponse.json({ error: 'Invalid handle' }, { status: 400 })
    }
    const walletStr = normalizeAddress(String(walletAddress || ''))
    if (!walletStr.startsWith('NQ')) {
      return NextResponse.json({ error: 'Invalid Nimiq wallet address' }, { status: 400 })
    }

    // --- Signature-bound authorization ----------------------------------
    // Creating a profile requires a fresh signature from the claimed wallet,
    // proving the requester actually controls that Nimiq address.
    const proof = auth as ProfileAuthProof | undefined
    if (!proof) {
      return NextResponse.json({ error: 'Missing wallet signature' }, { status: 401 })
    }
    if (proof.action !== 'create') {
      return NextResponse.json({ error: 'Invalid authorization action' }, { status: 400 })
    }
    if (normalizeHandle(String(proof.handle || '')) !== handleStr) {
      return NextResponse.json({ error: 'Signature handle mismatch' }, { status: 400 })
    }
    if (normalizeAddress(String(proof.walletAddress || '')) !== walletStr) {
      return NextResponse.json({ error: 'Signature wallet mismatch' }, { status: 400 })
    }
    const verdict = verifyProfileAuth(proof)
    if (!verdict.ok || verdict.signerAddress !== walletStr) {
      return NextResponse.json({ error: verdict.error || 'Invalid wallet signature' }, { status: 401 })
    }
    // One-time use: reject replays even within the freshness window.
    const fresh = await consumeAuthNonce(proof.signature, PROFILE_AUTH_TTL_MS)
    if (!fresh) {
      return NextResponse.json({ error: 'This signature was already used, please sign again' }, { status: 401 })
    }
    // --------------------------------------------------------------------

    const exists = await getProfile(handleStr)
    if (exists) {
      return NextResponse.json({ error: 'Handle already taken' }, { status: 409 })
    }

    const now = Date.now()
    const profile: CreatorProfile = {
      handle: handleStr,
      displayName: displayName ? String(displayName) : handleStr,
      bio: String(bio),
      contentUrl: String(contentUrl),
      walletAddress: walletStr,
      ownerPublicKey: proof.publicKey,
      goal: goal && typeof goal === 'object' ? { label: String((goal as any).label || 'Goal'), targetNIM: Number((goal as any).targetNIM || 1000) } : undefined,
      achievement: achievement ? String(achievement) : undefined,
      milestones: [],
      createdAt: now,
      updatedAt: now,
    }

    await setProfile(profile)
    return NextResponse.json({ success: true, handle: profile.handle })
  } catch (err: any) {
    const errorMsg = err.message || 'Failed to create profile'
    const errorDetails = err.toString?.()
    console.error('Profile creation error:', { msg: errorMsg, details: errorDetails, cause: err.cause })

    // Check if it's a KV connection error
    if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('unauthorized') || errorMsg.includes('401') || errorMsg.includes('403')) {
      return NextResponse.json(
        { error: 'Database connection failed. Check KV_REST_API_URL and KV_REST_API_TOKEN in .env.local' },
        { status: 503 }
      )
    }

    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
