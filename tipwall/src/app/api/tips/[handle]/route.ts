import { NextRequest, NextResponse } from 'next/server'
import { getProfile, getTips, getSupporters } from '@/lib/kv'

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const profile = await getProfile(handle)
  if (!profile) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  const tips = await getTips(handle)
  const supporters = await getSupporters(handle)
  const totalNIM = tips.reduce((sum, t) => sum + (t.amountNIM || 0), 0)
  return NextResponse.json({ tips, supporters, totalNIM })
}
