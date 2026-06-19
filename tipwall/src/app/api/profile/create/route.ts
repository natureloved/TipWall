import { NextRequest, NextResponse } from 'next/server'
import { getProfile, setProfile, consumeChallenge } from '@/lib/kv'
import { type CreatorProfile, type WalletSignature } from '@/lib/types'
import { verifyWalletSignature, addressesMatch } from '@/lib/nimiq-verify'

export const runtime = 'nodejs'

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
      signature,
    } = body as Record<string, unknown>

    const handleStr = String(handle || '').toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (!handleStr || handleStr.length < 3) {
      return NextResponse.json({ error: 'Invalid handle' }, { status: 400 })
    }
    const walletStr = String(walletAddress || '')
    if (!walletStr.startsWith('NQ')) {
      return NextResponse.json({ error: 'Invalid Nimiq wallet address' }, { status: 400 })
    }

    // Ownership proof: the caller must sign the create challenge with the wallet
    // they're registering. Without this, anyone could squat any handle/wallet.
    const sig = signature as Partial<WalletSignature> | undefined
    if (!sig?.publicKey || !sig?.signature || !sig?.nonce) {
      return NextResponse.json({ error: 'Wallet signature required' }, { status: 401 })
    }

    const challenge = await consumeChallenge(sig.nonce)
    if (!challenge || challenge.action !== 'create' || challenge.handle !== handleStr) {
      return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 401 })
    }

    const verified = await verifyWalletSignature({
      action: 'create',
      handle: handleStr,
      nonce: sig.nonce,
      publicKey: sig.publicKey,
      signature: sig.signature,
    })
    if (!verified.ok) {
      return NextResponse.json({ error: `Signature verification failed: ${verified.error}` }, { status: 401 })
    }
    // The signing wallet must be the payout wallet, so you can only register
    // an address you actually control.
    if (!addressesMatch(verified.address, walletStr)) {
      return NextResponse.json({ error: 'Signature does not match the provided wallet address' }, { status: 403 })
    }

    const exists = await getProfile(handleStr)
    if (exists) {
      return NextResponse.json({ error: 'Handle already taken' }, { status: 409 })
    }

    const profile: CreatorProfile = {
      handle: handleStr,
      displayName: displayName ? String(displayName) : handleStr,
      bio: String(bio),
      contentUrl: String(contentUrl),
      walletAddress: walletStr,
      ownerPublicKey: sig.publicKey,
      goal: goal && typeof goal === 'object' ? { label: String((goal as any).label || 'Goal'), targetNIM: Number((goal as any).targetNIM || 1000) } : undefined,
      achievement: achievement ? String(achievement) : undefined,
      milestones: [],
      createdAt: Date.now(),
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
