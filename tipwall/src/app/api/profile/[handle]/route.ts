import { NextResponse } from 'next/server'
import { getProfile, setProfile, consumeAuthNonce } from '@/lib/kv'
import { type CreatorProfile } from '@/lib/types'
import { normalizeAddress, normalizeHandle, PROFILE_AUTH_TTL_MS, type ProfileAuthProof } from '@/lib/profile-auth'
import { verifyProfileAuth } from '@/lib/verify-signature'

export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const profile = await getProfile(handle)
  if (!profile) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json(profile)
}

/**
 * Edit an existing profile. Requires a fresh `update` signature from the wallet
 * that originally created the profile (verified against the stored owner).
 * Only mutable presentation fields can be changed — handle and wallet/owner are
 * immutable so the signature binding can never be transferred.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params
    const handleStr = normalizeHandle(handle)

    const existing = await getProfile(handleStr)
    if (!existing) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    const body = await request.json()
    const { displayName, bio, contentUrl, goal, achievement, auth } = body as Record<string, unknown>

    // --- Signature-bound authorization ----------------------------------
    const proof = auth as ProfileAuthProof | undefined
    if (!proof) {
      return NextResponse.json({ error: 'Missing wallet signature' }, { status: 401 })
    }
    if (proof.action !== 'update') {
      return NextResponse.json({ error: 'Invalid authorization action' }, { status: 400 })
    }
    if (normalizeHandle(String(proof.handle || '')) !== handleStr) {
      return NextResponse.json({ error: 'Signature handle mismatch' }, { status: 400 })
    }

    const verdict = verifyProfileAuth(proof)
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.error || 'Invalid wallet signature' }, { status: 401 })
    }

    // Ownership: the signer must be the wallet that created this profile.
    const owner = normalizeAddress(existing.walletAddress)
    if (verdict.signerAddress !== owner) {
      return NextResponse.json({ error: 'Only the owner wallet can edit this profile' }, { status: 403 })
    }
    // Defense in depth: if we stored the owner key, it must match too.
    if (existing.ownerPublicKey && existing.ownerPublicKey !== proof.publicKey) {
      return NextResponse.json({ error: 'Signer key does not match the profile owner' }, { status: 403 })
    }
    // One-time use: reject replays even within the freshness window.
    const fresh = await consumeAuthNonce(proof.signature, PROFILE_AUTH_TTL_MS)
    if (!fresh) {
      return NextResponse.json({ error: 'This signature was already used, please sign again' }, { status: 401 })
    }
    // --------------------------------------------------------------------

    const updated: CreatorProfile = {
      ...existing,
      // Backfill owner key for legacy profiles created before this field existed.
      ownerPublicKey: existing.ownerPublicKey || proof.publicKey,
      displayName: displayName !== undefined ? String(displayName) || existing.handle : existing.displayName,
      bio: bio !== undefined ? String(bio) : existing.bio,
      contentUrl: contentUrl !== undefined ? String(contentUrl) : existing.contentUrl,
      achievement: achievement !== undefined ? (achievement ? String(achievement) : undefined) : existing.achievement,
      goal: goal !== undefined
        ? (goal && typeof goal === 'object'
            ? { label: String((goal as any).label || 'Goal'), targetNIM: Number((goal as any).targetNIM || 1000) }
            : undefined)
        : existing.goal,
      // Invalidate any cached OG metadata if the content URL changed.
      ogCache: contentUrl !== undefined && String(contentUrl) !== existing.contentUrl ? undefined : existing.ogCache,
      ogCachedAt: contentUrl !== undefined && String(contentUrl) !== existing.contentUrl ? undefined : existing.ogCachedAt,
      updatedAt: Date.now(),
    }

    await setProfile(updated)
    return NextResponse.json({ success: true, handle: updated.handle })
  } catch (err: any) {
    const errorMsg = err?.message || 'Failed to update profile'
    console.error('Profile update error:', errorMsg)
    if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('unauthorized') || errorMsg.includes('401') || errorMsg.includes('403')) {
      return NextResponse.json(
        { error: 'Database connection failed. Check KV_REST_API_URL and KV_REST_API_TOKEN in .env.local' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
