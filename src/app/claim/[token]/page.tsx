import { notFound } from 'next/navigation'
import { getClaim, getProfile } from '@/lib/kv'
import ClaimClient from './ClaimClient'

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const claim = await getClaim(token)
  if (!claim) notFound()
  const profile = await getProfile(claim.creatorHandle)
  if (!profile) notFound()
  return <ClaimClient claim={claim} profile={profile} />
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const claim = await getClaim(token)
  if (!claim) return { title: 'TipWall — Claim' }
  return {
    title: `Send ${claim.amountNIM} NIM to @${claim.creatorHandle} — TipWall`,
    description: `Complete your ${claim.amountNIM} NIM tip to @${claim.creatorHandle} in Nimiq Pay.`,
    robots: { index: false },
  }
}
