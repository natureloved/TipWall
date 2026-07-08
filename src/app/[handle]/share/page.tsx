import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/kv'
import ShareKit from '@/components/ShareKit'

/**
 * The creator's Share Kit. Landed on right after profile creation (?new=1),
 * and linkable any time from the wall and dashboard. Public on purpose — it
 * contains nothing private, and supporters sharing a creator's wall is a win.
 */
export default async function SharePage({ params, searchParams }: {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ new?: string }>
}) {
  const { handle } = await params
  const { new: isNew } = await searchParams
  const profile = await getProfile(handle)
  if (!profile) notFound()

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 px-4 py-10">
      <ShareKit handle={profile.handle} displayName={profile.displayName} isNew={isNew === '1'} />
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  return {
    title: `TipWall — Share @${handle}`,
    description: `Share kit for @${handle}'s TipWall: link, QR code, badge, and embeds.`,
    robots: { index: false },
  }
}
