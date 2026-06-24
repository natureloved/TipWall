import { notFound } from 'next/navigation'
import TipWallClient from './TipWallClient'
import { getProfile } from '@/lib/kv'

export default async function CreatorWallPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const profile = await getProfile(handle)
  if (!profile) notFound()
  return <TipWallClient handle={handle} initialProfile={profile} />
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const profile = await getProfile(handle)
  if (!profile) return { title: 'TipWall - Creator not found' }
  return {
    title: `TipWall — @${profile.handle}`,
    description: profile.bio || `Send NIM tips to @${profile.handle}`,
  }
}
