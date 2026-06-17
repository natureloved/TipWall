import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/kv'

export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const profile = await getProfile(handle)
  if (!profile) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json(profile)
}
