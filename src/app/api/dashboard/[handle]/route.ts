import { NextRequest, NextResponse } from 'next/server'
import { getGoalMilestones } from '@/lib/types'
import { getProfile, getTips, getSupporters, getVerifiedTotalNim, getMilestones, sanitizeTips } from '@/lib/kv'
import { normalizeAddress, type ProfileAuthProof } from '@/lib/profile-auth'
import { verifyProfileAuth } from '@/lib/verify-signature'
import { withinRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/** Decode the base64 JSON `view` proof carried in the x-tipwall-auth header. */
function readAuthProof(req: NextRequest): ProfileAuthProof | null {
  const raw = req.headers.get('x-tipwall-auth')
  if (!raw) return null
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as ProfileAuthProof
  } catch {
    return null
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  if (!await withinRateLimit(req, 'dashboard-read', 30)) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  }
  const { handle } = await params

  const profile = await getProfile(handle)
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Authorization: require a fresh, signed `view` proof from the owner wallet.
  // The wallet address alone is public, so a header claim is not trusted - the
  // signature is verified and must derive to the creator's wallet.
  const proof = readAuthProof(req)
  if (!proof || proof.action !== 'view') {
    return NextResponse.json({ error: 'Wallet signature required' }, { status: 401 })
  }
  const verdict = verifyProfileAuth(proof)
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.error || 'Invalid wallet signature' }, { status: 401 })
  }
  if (verdict.signerAddress !== normalizeAddress(profile.walletAddress)) {
    return NextResponse.json({ error: 'Unauthorized. Wallet does not match creator' }, { status: 403 })
  }

  // GET is read-only; the scheduled worker promotes pending tips separately.
  const allTips = await getTips(handle)
  const supporters = await getSupporters(handle)
  const tips = allTips.filter(t => t.verified)

  // Lifetime verified total comes from the persistent aggregate. The full tip
  // list is retained for the wall and CSV export, but the counter keeps this
  // headline metric cheap and exact.
  const totalNIM = await getVerifiedTotalNim(handle)

  const nextMilestone = getGoalMilestones(profile.goal?.targetNIM ?? 1000).find(m => m > totalNIM) ?? null

  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
  const recentTips = tips.filter(t => t.timestamp >= sevenDaysAgo)
  const byDay = new Map<string, { nim: number; count: number }>()
  for (const t of recentTips) {
    const day = new Date(t.timestamp).toISOString().slice(0, 10)
    const existing = byDay.get(day) || { nim: 0, count: 0 }
    existing.nim += t.amountNIM
    existing.count += 1
    byDay.set(day, existing)
  }
  const tipsLast7Days = Array.from(byDay.entries()).map(([date, v]) => ({ date, nim: v.nim, count: v.count }))

  const reasonCounts = new Map<string, number>()
  for (const t of tips) {
    if (t.reason) reasonCounts.set(t.reason, (reasonCounts.get(t.reason) || 0) + 1)
  }
  const topReason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return NextResponse.json({
    profile,
    // Anonymous tippers stay anonymous even to the creator.
    // Owners can review moderated rows; public readers receive only visible
    // tips from the public tips route.
    tips: sanitizeTips(allTips, { includeHidden: true }),
    supporters,
    totalNIM,
    totalTips: tips.length,
    // Milestones live under their own KV key, not on the profile object.
    milestonesUnlocked: await getMilestones(handle),
    nextMilestone,
    tipsLast7Days,
    topReason,
  })
}
