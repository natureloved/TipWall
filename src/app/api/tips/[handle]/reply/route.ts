import { NextResponse } from 'next/server'
import { getProfile, setTipReply, consumeAuthNonce, checkRateLimit } from '@/lib/kv'
import { normalizeAddress, normalizeHandle, PROFILE_AUTH_TTL_MS, type ProfileAuthProof } from '@/lib/profile-auth'
import { verifyProfileAuth } from '@/lib/verify-signature'

const REPLY_MAX = 120

/**
 * Pin (or replace) the creator's thank-you reply on a tip. Owner-only: the
 * same signature-bound guard as profile edits - fresh single-use `update`
 * proof from the wallet that created the wall.
 */
export async function POST(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle: rawHandle } = await params
    const handle = normalizeHandle(rawHandle)
    if (!handle) return NextResponse.json({ error: 'invalid handle' }, { status: 400 })

    const withinLimit = await checkRateLimit(`reply:${handle}`, 30, 60000)
    if (!withinLimit) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const body = await request.json()
    const tipId = String(body.tipId || '')
    const message = String(body.message || '').trim().slice(0, REPLY_MAX)
    if (!tipId || !message) return NextResponse.json({ error: 'tipId and message are required' }, { status: 400 })

    const profile = await getProfile(handle)
    if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const proof = body.auth as ProfileAuthProof | undefined
    if (!proof) return NextResponse.json({ error: 'Missing wallet signature' }, { status: 401 })
    if (proof.action !== 'update') return NextResponse.json({ error: 'Invalid authorization action' }, { status: 400 })
    if (normalizeHandle(String(proof.handle || '')) !== handle) return NextResponse.json({ error: 'Signature handle mismatch' }, { status: 400 })

    const verdict = verifyProfileAuth(proof)
    if (!verdict.ok) return NextResponse.json({ error: verdict.error || 'Invalid wallet signature' }, { status: 401 })
    if (verdict.signerAddress !== normalizeAddress(profile.walletAddress)) {
      return NextResponse.json({ error: 'Only the owner wallet can reply on this wall' }, { status: 403 })
    }
    if (profile.ownerPublicKey && profile.ownerPublicKey !== proof.publicKey) {
      return NextResponse.json({ error: 'Signer key does not match the profile owner' }, { status: 403 })
    }
    const fresh = await consumeAuthNonce(proof.signature, PROFILE_AUTH_TTL_MS)
    if (!fresh) return NextResponse.json({ error: 'This signature was already used, please sign again' }, { status: 401 })

    const updated = await setTipReply(handle, tipId, { message, at: Date.now() })
    if (!updated) return NextResponse.json({ error: 'Tip not found on this wall' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Tip reply error:', err)
    return NextResponse.json({ error: 'Failed to save reply' }, { status: 500 })
  }
}
