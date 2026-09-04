import { NextResponse } from 'next/server'
import { getProfile, transferProfileOwnership, consumeAuthNonce } from '@/lib/kv'
import { normalizeAddress, normalizeHandle, nimiqAddressError, PROFILE_AUTH_TTL_MS, type ProfileAuthProof } from '@/lib/profile-auth'
import { verifyProfileAuth } from '@/lib/verify-signature'
import { logError } from '@/lib/logger'
import { withinRateLimit } from '@/lib/rate-limit'

/** Two-party owner rotation: the current and destination wallets both sign. */
export async function POST(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    if (!await withinRateLimit(request, 'profile-transfer', 10)) {
      return NextResponse.json({ error: 'rate limited' }, { status: 429 })
    }
    const handle = normalizeHandle((await params).handle)
    const profile = await getProfile(handle)
    if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const body = await request.json() as Record<string, unknown>
    const newWalletAddress = normalizeAddress(String(body.newWalletAddress || ''))
    const addressError = nimiqAddressError(newWalletAddress)
    if (addressError) return NextResponse.json({ error: addressError }, { status: 400 })
    if (newWalletAddress === normalizeAddress(profile.walletAddress)) {
      return NextResponse.json({ error: 'Destination wallet already owns this wall' }, { status: 400 })
    }
    const currentAuth = body.auth as ProfileAuthProof | undefined
    const newAuth = body.newOwnerAuth as ProfileAuthProof | undefined
    if (!currentAuth || !newAuth) return NextResponse.json({ error: 'Both owner signatures are required' }, { status: 401 })
    for (const proof of [currentAuth, newAuth]) {
      if (proof.action !== 'transfer' || normalizeHandle(String(proof.handle || '')) !== handle || normalizeAddress(String(proof.transferTo || '')) !== newWalletAddress) {
        return NextResponse.json({ error: 'Invalid transfer authorization' }, { status: 400 })
      }
      const verdict = verifyProfileAuth(proof)
      if (!verdict.ok) return NextResponse.json({ error: verdict.error || 'Invalid wallet signature' }, { status: 401 })
      if (!await consumeAuthNonce(proof.signature, PROFILE_AUTH_TTL_MS)) {
        return NextResponse.json({ error: 'A transfer signature was already used, please sign again' }, { status: 401 })
      }
    }
    const currentVerdict = verifyProfileAuth(currentAuth)
    const newVerdict = verifyProfileAuth(newAuth)
    const ownerAddress = normalizeAddress(profile.walletAddress)
    const recoveryAddress = normalizeAddress(profile.recoveryWalletAddress || '')
    const authorizedRecovery = recoveryAddress && currentVerdict.signerAddress === recoveryAddress
    if (currentVerdict.signerAddress !== ownerAddress && !authorizedRecovery) {
      return NextResponse.json({ error: 'Current owner or recovery-wallet signature does not match this wall' }, { status: 403 })
    }
    if (newVerdict.signerAddress !== newWalletAddress || newAuth.publicKey === currentAuth.publicKey) {
      return NextResponse.json({ error: 'Destination wallet signature does not match the new owner' }, { status: 400 })
    }
    if (!authorizedRecovery && profile.ownerPublicKey && profile.ownerPublicKey !== currentAuth.publicKey) {
      return NextResponse.json({ error: 'Signer key does not match the profile owner' }, { status: 403 })
    }
    const updated = await transferProfileOwnership(profile, newWalletAddress, newAuth.publicKey)
    return NextResponse.json({ success: true, profile: updated })
  } catch (err) {
    logError('profile_transfer_failed', err)
    return NextResponse.json({ error: 'Failed to transfer ownership' }, { status: 500 })
  }
}
