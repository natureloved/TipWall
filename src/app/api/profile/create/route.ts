import { NextRequest, NextResponse } from 'next/server'
import { getProfile, setProfile } from '@/lib/kv'
import { type CreatorProfile } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      handle,
      displayName,
      bio = '',
      contentUrl = '',
      walletAddress,
      goal,
      achievement,
    } = body as Record<string, unknown>

    const handleStr = String(handle || '').toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (!handleStr || handleStr.length < 3) {
      return NextResponse.json({ error: 'Invalid handle' }, { status: 400 })
    }
    const walletStr = String(walletAddress || '')
    if (!walletStr.startsWith('NQ')) {
      return NextResponse.json({ error: 'Invalid Nimiq wallet address' }, { status: 400 })
    }

    const exists = await getProfile(handleStr)
    if (exists) {
      return NextResponse.json({ error: 'Handle already taken' }, { status: 409 })
    }

    const profile: CreatorProfile = {
      handle: handleStr,
      displayName: displayName ? String(displayName) : handleStr,
      bio: String(bio),
      contentUrl: String(contentUrl),
      walletAddress: walletStr,
      goal: goal && typeof goal === 'object' ? { label: String((goal as any).label || 'Goal'), targetNIM: Number((goal as any).targetNIM || 1000) } : undefined,
      achievement: achievement ? String(achievement) : undefined,
      milestones: [],
      createdAt: Date.now(),
    }

    await setProfile(profile)
    return NextResponse.json({ success: true, handle: profile.handle })
  } catch (err: any) {
    console.error('Profile creation error:', err)
    return NextResponse.json({ error: err.message || 'Failed to create profile' }, { status: 500 })
  }
}
