import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/kv'
import AnalyticsClient from './AnalyticsClient'

export default async function AnalyticsPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const profile = await getProfile(handle)
  if (!profile) notFound()
  return <AnalyticsClient handle={profile.handle} ownerAddress={profile.walletAddress} />
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  return { title: `Analytics — @${handle} — TipWall`, robots: { index: false } }
}
