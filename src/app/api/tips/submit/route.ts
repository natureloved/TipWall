import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { Tip, CreatorProfile, MilestoneEvent } from '@/lib/types'
import { checkMilestone } from '@/lib/milestones'

async function verifyTx(txHash: string, recipient: string, amountLuna: number): Promise<boolean> {
  try {
    const res = await fetch(process.env.NIMIQ_RPC_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransactionByHash',
        params: [txHash],
      }),
    })
    const data = await res.json()
    const tx = data.result
    return !!tx && tx.toAddress === recipient && Number(tx.value) >= amountLuna
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Tip> & { handle?: string; txHash?: string }
    if (!body.handle || !body.senderAddress || !body.txHash || typeof body.amountNIM !== 'number') {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 })
    }
    const handle: string = body.handle
    const profileRaw = await kv.get<CreatorProfile>(`profile:${handle}`)
    if (!profileRaw) {
      return NextResponse.json({ error: 'creator not found' }, { status: 404 })
    }
    const profile = profileRaw as any

    const verified = await verifyTx(body.txHash, profile.walletAddress, body.amountNIM * 100000)
    const existing = await kv.get<Tip[]>(`tips:${handle}`) || []
    const previousTotal = existing.reduce((sum, t) => sum + (t.amountNIM || 0), 0)
    const newTotal = previousTotal + body.amountNIM

    const tip: Tip = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      handle,
      senderAddress: body.senderAddress,
      amountNIM: body.amountNIM,
      txHash: body.txHash,
      verified,
      timestamp: (body as any).timestamp ?? Date.now(),
      reason: body.reason,
      message: (body.message || '').slice(0, 64),
      anonymous: !!body.anonymous,
    }

    const updated = [tip, ...existing].slice(0, 200)
    await kv.set(`tips:${handle}`, updated)

    const milestone = checkMilestone(previousTotal, newTotal, tip.senderAddress)
    if (milestone) {
      const updatedProfile = {
        ...profile,
        milestones: [...(profile.milestones || []), milestone],
      }
      await kv.set(`profile:${handle}`, updatedProfile)
    }

    return NextResponse.json({ success: true, tip, milestone })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
