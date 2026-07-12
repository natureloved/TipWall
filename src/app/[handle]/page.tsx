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
  const title = `TipWall — @${profile.handle}`
  const description = profile.bio || `Send NIM tips to @${profile.handle}`
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://tipwall.vercel.app').replace(/\/+$/, '')
  // og:image / twitter:image come from the opengraph-image.tsx file convention.
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${profile.handle}`,
      siteName: 'TipWall',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}
