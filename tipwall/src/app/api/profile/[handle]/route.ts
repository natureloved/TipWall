import { NextResponse } from 'next/server'
import { getProfile, setProfile, consumeChallenge } from '@/lib/kv'
import { type CreatorProfile, type WalletSignature } from '@/lib/types'
import { verifyWalletSignature } from '@/lib/nimiq-verify'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const profile = await getProfile(handle)
  if (!profile) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json(profile)
}

/**
 * Update an existing profile. Requires a signature from the wallet that created
 * it (the bound `ownerPublicKey`). Identity fields (handle, walletAddress,
 * ownerPublicKey) are immutable here; only presentation fields can change.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params
    const handleStr = handle.toLowerCase()
    const profile = await getProfile(handleStr)
    if (!profile) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    if (!profile.ownerPublicKey) {
      return NextResponse.json({ error: 'This profile predates ownership signing and cannot be edited' }, { status: 409 })
    }

    const body = await request.json()
    const sig = body.signature as Partial<WalletSignature> | undefined
    if (!sig?.signature || !sig?.nonce) {
      return NextResponse.json({ error: 'Wallet signature required' }, { status: 401 })
    }

    const challenge = await consumeChallenge(sig.nonce)
    if (!challenge || challenge.action !== 'edit' || challenge.handle !== handleStr) {
      return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 401 })
    }

    // Verify against the bound owner key, not anything the client supplies, so
    // only the original owner can pass.
    const verified = await verifyWalletSignature({
      action: 'edit',
      handle: handleStr,
      nonce: sig.nonce,
      publicKey: profile.ownerPublicKey,
      signature: sig.signature,
    })
    if (!verified.ok) {
      return NextResponse.json({ error: 'Not authorized to edit this profile' }, { status: 403 })
    }

    const updated: CreatorProfile = { ...profile }
    if (typeof body.displayName === 'string') updated.displayName = body.displayName
    if (typeof body.bio === 'string') updated.bio = body.bio
    if (typeof body.contentUrl === 'string') updated.contentUrl = body.contentUrl
    if (typeof body.achievement === 'string') updated.achievement = body.achievement || undefined
    if (body.goal && typeof body.goal === 'object') {
      updated.goal = { label: String(body.goal.label || 'Goal'), targetNIM: Number(body.goal.targetNIM || 1000) }
    }

    await setProfile(updated)
    return NextResponse.json({ success: true, profile: updated })
  } catch (err: any) {
    console.error('Profile update error:', err)
    return NextResponse.json({ error: err.message || 'Failed to update profile' }, { status: 500 })
  }
}
