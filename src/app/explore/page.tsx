import Link from 'next/link'
import { kv } from '@vercel/kv'
import {
  getActiveHandles,
  getProfile,
  getVerifiedTotalNim,
  getTips,
  LEADERBOARD_WINDOW_MS,
} from '@/lib/kv'
import type { CreatorProfile, Tip } from '@/lib/types'
import MissionLink from '@/components/MissionLink'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'TipWall — Most tipped creators this week',
  description: 'Live leaderboard of creator tipping walls on Nimiq. Tip the creator. Not the platform.',
  openGraph: {
    title: 'Most tipped creators this week',
    description: 'Live leaderboard of creator tipping walls on Nimiq. Tip the creator. Not the platform.',
    url: 'https://tipwall.vercel.app/explore',
    images: [{ url: '/banner.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Most tipped creators this week',
    description: 'Live leaderboard of creator tipping walls on Nimiq. Tip the creator. Not the platform.',
    images: ['/banner.png'],
  },
}

const MAX_WALLS = 24
const PROFILE_PREFIX = 'tipwall:profile:'

type ExploreWall = {
  profile: CreatorProfile
  totalNIM: number
  recentNIM: number
  recentTips: number
}

async function loadWalls(): Promise<ExploreWall[]> {
  let handles = await getActiveHandles(MAX_WALLS)

  if (handles.length < MAX_WALLS) {
    try {
      const keys = await kv.keys(`${PROFILE_PREFIX}*`)
      const allHandles = keys.map(k => k.slice(PROFILE_PREFIX.length))
      const seen = new Set(handles)
      const legacy = allHandles.filter(h => !seen.has(h))
      handles = [...handles, ...legacy.slice(0, MAX_WALLS - handles.length)]
    } catch {
      // Best effort — if KV keys() fails, just use the active set.
    }
  }

  const cutoff = Date.now() - LEADERBOARD_WINDOW_MS

  // Parallel: one Promise per wall, each fetching profile + tips in parallel.
  // getTips() is called once per wall; totalNIM and recentNIM both derive from it.
  const results = await Promise.all(
    handles.slice(0, MAX_WALLS).map(async (handle): Promise<ExploreWall | null> => {
      const [profile, tips] = await Promise.all([
        getProfile(handle),
        getTips(handle),
      ])
      if (!profile) return null
      const totalNIM = await getVerifiedTotalNim(handle)
      if (totalNIM <= 0) return null
      const recentNIM = tips.reduce(
        (sum: number, t: Tip) => (t.verified && t.timestamp >= cutoff ? sum + (t.amountNIM || 0) : sum),
        0,
      )
      const recentTips = tips.filter((t: Tip) => t.verified && t.timestamp >= cutoff).length
      return { profile, totalNIM, recentNIM, recentTips }
    }),
  )

  const walls = results.filter((w): w is ExploreWall => w !== null)

  // Sort: recentNIM desc, tiebreak by totalNIM desc
  walls.sort((a, b) => b.recentNIM - a.recentNIM || b.totalNIM - a.totalNIM)
  return walls
}

const RANK_BADGE = [
  // 1st — gold, with a subtle glow
  'bg-[#F6B221] text-slate-900 shadow-lg shadow-amber-400/20',
  // 2nd — silver/slate
  'bg-slate-300 text-slate-900',
  // 3rd — bronze
  'bg-[#CD7F32] text-amber-50',
]

export default async function ExplorePage() {
  const walls = await loadWalls()

  const trending = walls.filter(w => w.recentNIM > 0).slice(0, 3)
  const trendingHandles = new Set(trending.map(w => w.profile.handle))
  const rest = walls.filter(w => !trendingHandles.has(w.profile.handle))

  // Ecosystem totals: derived from the already-loaded array, no extra KV reads.
  const wallCount = walls.length
  const weekNIM = walls.reduce((sum, w) => sum + w.recentNIM, 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">
            Explore TipWalls
          </h1>
          {wallCount > 0 && (
            <p className="text-sm text-slate-400 mt-2">
              {wallCount.toLocaleString()} creator {wallCount === 1 ? 'wall' : 'walls'}
              {' · '}
              {Math.round(weekNIM).toLocaleString()} NIM tipped this week
            </p>
          )}
          <div className="mt-3">
            <MissionLink />
          </div>
        </div>

        {walls.length === 0 ? (
          <div className="text-center rounded-2xl bg-slate-800 p-10">
            <p className="text-4xl mb-3">🌱</p>
            <p className="text-slate-300 font-semibold">No walls yet — yours could be the first.</p>
          </div>
        ) : (
          <>
            {/* Leaderboard — only when at least one wall has recent activity.
                Until tips start landing, this is empty and the flat grid below
                carries the page. */}
            {trending.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-bold text-white">🔥 Most tipped this week</h2>
                <p className="text-xs text-slate-500 mb-3">Updated live · last 7 days</p>
                <div className="space-y-3">
                  {trending.map(({ profile, totalNIM, recentNIM }, i) => (
                    <a
                      key={profile.handle}
                      href={`/${profile.handle}`}
                      className="flex items-center gap-3 rounded-2xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 hover:border-amber-400/40 p-4 sm:p-5 transition-colors"
                    >
                      <div
                        className={`flex-none flex items-center justify-center w-9 h-9 rounded-full font-bold text-base ${RANK_BADGE[i]}`}
                        aria-label={`Rank ${i + 1}`}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-amber-300 truncate">
                          {profile.displayName || `@${profile.handle}`}
                        </p>
                        <p className="text-xs text-slate-500 truncate">@{profile.handle}</p>
                        {profile.bio && (
                          <p className="text-sm text-slate-300 mt-1 line-clamp-2">{profile.bio}</p>
                        )}
                        {profile.achievement && (
                          <p className="text-xs text-amber-200/80 mt-1 truncate">🏆 {profile.achievement}</p>
                        )}
                      </div>
                      <div className="flex-none text-right">
                        <p className="text-lg font-bold text-amber-300 whitespace-nowrap">
                          {Math.round(recentNIM).toLocaleString()} NIM
                        </p>
                        <p className="text-xs text-slate-500">this week</p>
                        <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">
                          {Math.round(totalNIM).toLocaleString()} NIM all time
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {rest.length > 0 && (
              <section>
                {trending.length > 0 && (
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
                    More creator walls
                  </h2>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {rest.map(({ profile, totalNIM }) => (
                    <a
                      key={profile.handle}
                      href={`/${profile.handle}`}
                      className="block rounded-2xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 hover:border-amber-400/40 p-5 transition-colors"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-bold text-amber-300 truncate">
                          {profile.displayName || `@${profile.handle}`}
                        </p>
                        <p className="shrink-0 text-xs font-semibold text-emerald-400">
                          {Math.round(totalNIM).toLocaleString()} NIM
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">@{profile.handle}</p>
                      {profile.bio && (
                        <p className="text-sm text-slate-300 mt-2 line-clamp-2">{profile.bio}</p>
                      )}
                      {profile.achievement && (
                        <p className="text-xs text-amber-200/80 mt-2 truncate">🏆 {profile.achievement}</p>
                      )}
                    </a>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <div className="text-center mt-10">
          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-900 font-bold text-sm transition-all"
          >
            Create your own TipWall
          </Link>
        </div>
      </div>
    </div>
  )
}
