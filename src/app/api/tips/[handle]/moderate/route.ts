import { NextResponse } from 'next/server'
import { checkRateLimit, consumeAuthNonce, deleteTip, getProfile, setTipHidden } from '@/lib/kv'
import { normalizeAddress, normalizeHandle, PROFILE_AUTH_TTL_MS, type ProfileAuthProof } from '@/lib/profile-auth'
import { verifyProfileAuth } from '@/lib/verify-signature'
import { logError } from '@/lib/logger'

type ModerationAction = 'hide' | 'restore' | 'delete'

/** Owner-signed moderation for public supporter messages. */
export async function POST(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const handle = normalizeHandle((await params).handle)
    if (!handle) return NextResponse.json({ error: 'invalid handle' }, { status: 400 })
    if (!await checkRateLimit(`moderate:${handle}`, 30, 60_000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await request.json() as Record<string, unknown>
    const tipId = String(body.tipId || '').trim()
    const action = String(body.action || '') as ModerationAction
    if (!tipId || !['hide', 'restore', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'tipId and a valid action are required' }, { status: 400 })
    }
    const profile = await getProfile(handle)
    if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const proof = body.auth as ProfileAuthProof | undefined
    if (!proof || proof.action !== 'update' || normalizeHandle(String(proof.handle || '')) !== handle) {
      return NextResponse.json({ error: 'Missing or invalid wallet signature' }, { status: 401 })
    }
    const verdict = verifyProfileAuth(proof)
    if (!verdict.ok) return NextResponse.json({ error: verdict.error || 'Invalid wallet signature' }, { status: 401 })
    if (verdict.signerAddress !== normalizeAddress(profile.walletAddress)) {
      return NextResponse.json({ error: 'Only the owner wallet can moderate this wall' }, { status: 403 })
    }
    if (profile.ownerPublicKey && profile.ownerPublicKey !== proof.publicKey) {
      return NextResponse.json({ error: 'Signer key does not match the profile owner' }, { status: 403 })
    }
    if (!await consumeAuthNonce(proof.signature, PROFILE_AUTH_TTL_MS)) {
      return NextResponse.json({ error: 'This signature was already used, please sign again' }, { status: 401 })
    }

    const updated = action === 'delete'
      ? await deleteTip(handle, tipId)
      : await setTipHidden(handle, tipId, action === 'hide')
    if (!updated) return NextResponse.json({ error: 'Tip not found on this wall' }, { status: 404 })
    return NextResponse.json({ success: true, action })
  } catch (err) {
    logError('tip_moderation_failed', err)
    return NextResponse.json({ error: 'Failed to moderate tip' }, { status: 500 })
  }
}
