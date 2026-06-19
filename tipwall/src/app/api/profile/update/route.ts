import { NextRequest, NextResponse } from 'next/server'
import { getProfile, setProfile, consumeChallenge } from '@/lib/kv'
import { type CreatorProfile, type WalletSignature } from '@/lib/types'
import { verifyWalletSignature } from '@/lib/nimiq-verify'

export const runtime = 'nodejs'

interface UpdateBody {
  handle: string
  displayName?: string
  bio?: string
  contentUrl?: string
  achievement?: string
  goal?: { label: string; targetNIM: number }
  signature?: Partial<WalletSignature>
}

/**
 * Update an existing profile. Requires a real signature from the wallet that
 * created it (the bound `ownerPublicKey`), verified against a single-use edit
 * challenge. Identity fields (handle, walletAddress, ownerPublicKey) are
 * immutable here; only presentation fields can change.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json() as UpdateBody
    const { handle, displayName, bio, contentUrl, achievement, goal, signature } = body

    const handleStr = String(handle || '').toLowerCase()
    if (!handleStr) {
      return NextResponse.json({ error: 'Handle required' }, { status: 400 })
    }

    const profile = await getProfile(handleStr)
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    if (!profile.ownerPublicKey) {
      return NextResponse.json({ error: 'This profile predates ownership signing and cannot be edited' }, { status: 409 })
    }

    if (!signature?.signature || !signature?.nonce) {
      return NextResponse.json({ error: 'Wallet signature required' }, { status: 401 })
    }

    const challenge = await consumeChallenge(signature.nonce)
    if (!challenge || challenge.action !== 'edit' || challenge.handle !== handleStr) {
      return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 401 })
    }

    // Verify against the bound owner key — not anything the client supplies —
    // so only the original owner can pass.
    const verified = await verifyWalletSignature({
      action: 'edit',
      handle: handleStr,
      nonce: signature.nonce,
      publicKey: profile.ownerPublicKey,
      signature: signature.signature,
    })
    if (!verified.ok) {
      return NextResponse.json({ error: 'Not authorized to edit this profile' }, { status: 403 })
    }

    const updated: CreatorProfile = { ...profile }
    if (typeof displayName === 'string') updated.displayName = displayName
    if (typeof bio === 'string') updated.bio = bio
    if (typeof contentUrl === 'string') updated.contentUrl = contentUrl
    if (typeof achievement === 'string') updated.achievement = achievement || undefined
    if (goal && typeof goal === 'object') {
      updated.goal = { label: String(goal.label || 'Goal'), targetNIM: Number(goal.targetNIM || 1000) }
    }

    await setProfile(updated)
    return NextResponse.json({ success: true, profile: updated })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update profile'
    console.error('Profile update error:', errorMsg)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}