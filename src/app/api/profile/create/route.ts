import { NextRequest, NextResponse } from 'next/server'
import { setProfileNX, addProfileToWalletIndex, consumeAuthNonce, touchActivity, isHandleTombstoned } from '@/lib/kv'
import { type CreatorProfile } from '@/lib/types'
import { normalizeAddress, normalizeHandle, PROFILE_AUTH_TTL_MS, type ProfileAuthProof } from '@/lib/profile-auth'
import { verifyProfileAuth } from '@/lib/verify-signature'
import { validateHandle, validateContentUrl, clampProfileFields, CONTENT_URL_MAX } from '@/lib/validate-profile'

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
    const handleError = validateHandle(handleStr)
    if (handleError) {
      return NextResponse.json({ error: handleError }, { status: 400 })
    }
    // A deleted wall's handle stays burned — otherwise anyone could re-register
    // it and impersonate the previous owner to their existing audience.
    if (await isHandleTombstoned(handleStr)) {
      return NextResponse.json({ error: 'This handle belonged to a deleted wall and cannot be reused' }, { status: 409 })
    }
    const walletStr = normalizeAddress(String(walletAddress || ''))
    if (!walletStr.startsWith('NQ')) {
      return NextResponse.json({ error: 'Invalid Nimiq wallet address' }, { status: 400 })
    }
    const contentUrlStr = String(contentUrl || '').slice(0, CONTENT_URL_MAX)
    const urlError = validateContentUrl(contentUrlStr)
    if (urlError) {
      return NextResponse.json({ error: urlError }, { status: 400 })
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

    const now = Date.now()
    const clamped = clampProfileFields({ displayName, bio, achievement, goal })
    const profile: CreatorProfile = {
      handle: handleStr,
      displayName: clamped.displayName || handleStr,
      bio: clamped.bio || '',
      contentUrl: contentUrlStr,
      walletAddress: walletStr,
      ownerPublicKey: proof.publicKey,
      goal: clamped.goal,
      achievement: clamped.achievement,
      milestones: [],
      createdAt: now,
      updatedAt: now,
    }

    const created = await setProfileNX(profile)
    if (!created) {
      return NextResponse.json({ error: 'Handle already taken' }, { status: 409 })
    }

    await addProfileToWalletIndex(profile)
    await touchActivity(profile.handle) // surface new walls on /explore

    return NextResponse.json({ success: true, handle: profile.handle })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to create profile'
    console.error('Profile creation error:', err)

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
