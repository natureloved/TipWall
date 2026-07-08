import { NextRequest, NextResponse } from 'next/server'
import { getProfile, getStats, getTips } from '@/lib/kv'
import { normalizeAddress, normalizeHandle, type ProfileAuthProof } from '@/lib/profile-auth'
import { verifyProfileAuth } from '@/lib/verify-signature'

/**
 * Return a creator's funnel analytics — gated by an owner `view` signature so
 * only the wallet that owns the profile can read its conversion data.
 *
 * POST body: { auth: ProfileAuthProof (action 'view') }
 * The nonce is intentionally NOT consumed here (reads are idempotent and the
 * owner may refresh); the 5-minute signature TTL still bounds replay.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params
    const handleStr = normalizeHandle(handle)

    const profile = await getProfile(handleStr)
    if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const proof = body.auth as ProfileAuthProof | undefined
    if (!proof) return NextResponse.json({ error: 'Missing wallet signature' }, { status: 401 })
    if (proof.action !== 'view') return NextResponse.json({ error: 'Invalid authorization action' }, { status: 400 })
    if (normalizeHandle(String(proof.handle || '')) !== handleStr) {
      return NextResponse.json({ error: 'Signature handle mismatch' }, { status: 400 })
    }

    const verdict = verifyProfileAuth(proof)
    if (!verdict.ok) return NextResponse.json({ error: verdict.error || 'Invalid signature' }, { status: 401 })
    if (verdict.signerAddress !== normalizeAddress(profile.walletAddress)) {
      return NextResponse.json({ error: 'Only the owner wallet can view analytics' }, { status: 403 })
    }

    const stats = await getStats(handleStr)
    const tips = await getTips(handleStr)

    const views = stats.TIP_WALL_VIEWED
    const completed = Math.max(stats.TIP_COMPLETED, tips.length) // tips are the source of truth
    const conversionRate = views > 0 ? Number(((completed / views) * 100).toFixed(1)) : 0
    const recovered = stats.RETURNED_AFTER_INSTALL
    const lost = Math.max(0, stats.INSTALL_PROMPT_SHOWN - recovered)

    return NextResponse.json({
      stats,
      derived: {
        completedTips: completed,
        conversionRate,
        recoveredSupporters: recovered,
        lostSupporters: lost,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load analytics'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
