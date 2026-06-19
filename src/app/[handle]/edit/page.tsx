import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/kv'
import EditProfileClient from './EditProfileClient'

export default async function EditProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const profile = await getProfile(handle)
  if (!profile) notFound()
  // Never ship secrets to the client; the public profile fields are fine.
  return <EditProfileClient handle={profile.handle} profile={profile} />
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  return { title: `Edit @${handle} — TipWall`, robots: { index: false } }
}
