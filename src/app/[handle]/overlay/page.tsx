import { notFound } from 'next/navigation'
import OverlayClient from './OverlayClient'
import { getProfile } from '@/lib/kv'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'TipWall stream overlay',
  robots: { index: false, follow: false },
}

export default async function OverlayPage({ params, searchParams }: {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ preview?: string }>
}) {
  const { handle } = await params
  const { preview } = await searchParams
  const profile = await getProfile(handle)
  if (!profile) notFound()
  return <OverlayClient handle={handle} preview={preview === '1'} />
}
