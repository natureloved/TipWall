import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export async function POST(req: NextRequest) {
  const { handle, walletAddress, bio, contentUrl, achievement, goal } = await req.json()

  const profileRaw = await kv.get(`tipwall:profile:${handle.toLowerCase()}`)
  if (!profileRaw) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const profile = JSON.parse(profileRaw as string)

  if (walletAddress !== profile.walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const updated = {
    ...profile,
    bio: bio ?? profile.bio,
    contentUrl: contentUrl ?? profile.contentUrl,
    achievement: achievement ?? profile.achievement,
    goal: goal ?? profile.goal,
    updatedAt: Date.now(),
  }

  await kv.set(`tipwall:profile:${handle.toLowerCase()}`, JSON.stringify(updated))
  return NextResponse.json({ success: true, profile: updated })
}