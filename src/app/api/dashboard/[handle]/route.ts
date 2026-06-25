import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { Tip, MILESTONES, Supporter } from '@/lib/types'

export async function GET(req: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const requesterAddress = req.headers.get('x-wallet-address')

  const profileRaw = await kv.get(`tipwall:profile:${handle.toLowerCase()}`)
  if (!profileRaw) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const profile = JSON.parse(profileRaw as string)

  if (!requesterAddress || requesterAddress !== profile.walletAddress) {
    return NextResponse.json({ error: 'Unauthorized — wallet does not match creator' }, { status: 403 })
  }

  const tipsRaw = await kv.get(`tipwall:tips:${handle.toLowerCase()}`)
  const tips: Tip[] = tipsRaw ? JSON.parse(tipsRaw as string) : []

  const totalNIM = tips.reduce((sum, t) => sum + t.amountNIM, 0)

  const supporterMap = new Map<string, Supporter>()
  for (const tip of tips) {
    const existing = supporterMap.get(tip.senderAddress)
    if (existing) {
      existing.totalNIM += tip.amountNIM
      existing.tipCount += 1
    } else {
      supporterMap.set(tip.senderAddress, {
        address: tip.senderAddress,
        totalNIM: tip.amountNIM,
        tipCount: 1,
        firstTipAt: tip.timestamp,
      })
    }
  }
  const supporters = Array.from(supporterMap.values()).sort((a, b) => b.totalNIM - a.totalNIM || a.firstTipAt - b.firstTipAt)

  const nextMilestone = MILESTONES.find(m => m > totalNIM) ?? null

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
    tips,
    supporters,
    totalNIM,
    totalTips: tips.length,
    milestonesUnlocked: profile.milestones || [],
    nextMilestone,
    tipsLast7Days,
    topReason,
  })
}