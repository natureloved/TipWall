import { notFound } from 'next/navigation'
import TipWallClient from './TipWallClient'
import { getProfile, stripSensitiveProfileFields } from '@/lib/kv'

export default async function CreatorWallPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const profile = await getProfile(handle)
  if (!profile) notFound()

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://tipwall.vercel.app').replace(/\/+$/, '')
  const wallUrl = `${baseUrl}/${profile.handle}`
  const displayName = profile.displayName || `@${profile.handle}`
  const description = profile.bio || `Support ${displayName} directly in NIM on TipWall.`

  // Structured data so Google can render rich results for creator walls (the
  // highest-value organic surface). Person + ProfilePage; social links become
  // sameAs so a creator's other profiles get associated in the knowledge graph.
  const social = profile.socialLinks
  const sameAs = social
    ? Object.values(social).filter((v): v is string => typeof v === 'string' && v.length > 0)
    : []
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: wallUrl,
    name: displayName,
    description,
    mainEntity: {
      '@type': 'Person',
      name: displayName,
      alternateName: `@${profile.handle}`,
      url: wallUrl,
      description,
      ...(sameAs.length > 0 ? { sameAs } : {}),
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TipWallClient handle={handle} initialProfile={stripSensitiveProfileFields(profile)} />
    </>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const profile = await getProfile(handle)
  if (!profile) return { title: 'TipWall | Wall not found' }
  const title = `TipWall | @${profile.handle}`
  const description = profile.bio || `Support @${profile.handle} directly in NIM`
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
