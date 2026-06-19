import { NextRequest, NextResponse } from 'next/server'
import { getProfile, setChallenge } from '@/lib/kv'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { handle } = body
  if (!handle) return NextResponse.json({ error: 'handle required' }, { status: 400 })

  const profile = await getProfile(handle)
  if (!profile) return NextResponse.json({ error: 'profile not found' }, { status: 404 })

  const nonce = randomBytes(16).toString('hex')
  await setChallenge(nonce, { handle, action: 'edit' })

  return NextResponse.json({ 
    challenge: nonce, 
    message: `Sign to edit @${handle}` 
  })
}