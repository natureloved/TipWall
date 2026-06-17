import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { Tip, Supporter } from '@/lib/types'

function deriveSupporters(tips: Tip[]): Supporter[] {
  const map = new Map<string, Supporter>()
  for (const tip of tips) {
    if (tip.anonymous) continue
    const s = map.get(tip.senderAddress)
    if (s) {
      s.totalNIM += tip.amountNIM
      s.tipCount += 1
    } else {
      map.set(tip.senderAddress, {
        address: tip.senderAddress,
        totalNIM: tip.amountNIM,
        tipCount: 1,
        firstTipAt: tip.timestamp,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalNIM - a.totalNIM || a.address.localeCompare(b.address))
}

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const profileRaw = await kv.get(`profile:${handle}`)
  if (!profileRaw) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  const tips = (await kv.get<Tip[]>(`tips:${handle}`)) || []
  const supporters = deriveSupporters(tips)
  const totalNIM = tips.reduce((sum, t) => sum + (t.amountNIM || 0), 0)
  return NextResponse.json({ tips, supporters, totalNIM })
}
