import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/kv'
import RecoveryClient from './RecoveryClient'

export default async function RecoveryPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const profile = await getProfile(handle)
  if (!profile) notFound()
  return <RecoveryClient handle={profile.handle} />
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  return { title: `Recover @${handle} | TipWall`, robots: { index: false } }
}
