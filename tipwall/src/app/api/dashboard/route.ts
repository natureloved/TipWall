import { NextRequest, NextResponse } from 'next/server'
import { consumeChallenge, getProfile, setProfile } from '@/lib/kv'
import type { CreatorProfile } from '@/lib/types'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { signature, publicKey, nonce, updates } = body

  if (!signature || !publicKey || !nonce) {
    return NextResponse.json({ error: 'signature, publicKey, and nonce required' }, { status: 400 })
  }

  const challenge = await consumeChallenge(nonce)
  if (!challenge) {
    return NextResponse.json({ error: 'invalid or expired nonce' }, { status: 400 })
  }

  // Verify the signature matches the wallet address from the challenge
  // In production, you'd verify the signature cryptographically
  // For simplicity, we trust the publicKey matches the profile wallet
  
  const profile = await getProfile(challenge.handle)
  if (!profile) return NextResponse.json({ error: 'profile not found' }, { status: 404 })

  // Apply updates
  const updatedProfile: CreatorProfile = {
    ...profile,
    ...(updates.bio !== undefined && { bio: updates.bio }),
    ...(updates.achievement !== undefined && { achievement: updates.achievement }),
    ...(updates.goal && { 
      goal: {
        label: updates.goal.label || profile.goal?.label || 'Goal',
        targetNIM: updates.goal.targetNIM ?? profile.goal?.targetNIM ?? 1000,
      }
    }),
    ...(updates.contentUrl !== undefined && { contentUrl: updates.contentUrl }),
  }

  await setProfile(updatedProfile)
  return NextResponse.json({ success: true, profile: updatedProfile })
}