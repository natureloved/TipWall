import { NextResponse } from 'next/server'
import { getClaim } from '@/lib/kv'

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const claim = await getClaim(token)
  if (!claim) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  }
  return NextResponse.json(claim)
}
