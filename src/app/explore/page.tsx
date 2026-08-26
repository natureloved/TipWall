import Link from 'next/link'
import { kv } from '@vercel/kv'
import {
  getActiveHandles,
  getProfile,
  getVerifiedTotalNim,
  getTips,
  LEADERBOARD_WINDOW_MS,
} from '@/lib/kv'
import { TIP_REASON_LABELS, type CreatorProfile, type Tip, type TipReason } from '@/lib/types'
import MissionLink from '@/components/MissionLink'
import { timeAgo } from '@/lib/time'

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

/**
 * New walls are surfaced for their first 48h even with no tips — a creator who
 * just signed up must be able to find themselves. After that, a wall needs at
 * least one verified tip to stay listed, so abandoned/test walls fall off.
 */
const NEW_WALL_GRACE_MS = 48 * 60 * 60 * 1000

// Cap the "Just joined" section so nobody can flood the front door by
// mass-registering handles.
const MAX_NEW_WALLS = 6

type ExploreWall = {
  profile: CreatorProfile
  totalNIM: number
  recentNIM: number
  recentTips: number
  isNew: boolean
  lastTipAt: number | null
  topReason: TipReason | null
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
      const isNew = Date.now() - profile.createdAt < NEW_WALL_GRACE_MS
      if (totalNIM <= 0 && !isNew) return null
      const recentNIM = tips.reduce(
        (sum: number, t: Tip) => (t.verified && t.timestamp >= cutoff ? sum + (t.amountNIM || 0) : sum),
        0,
      )
      const recentTips = tips.filter((t: Tip) => t.verified && t.timestamp >= cutoff).length
      const reasons = (Object.keys(TIP_REASON_LABELS) as TipReason[]).map(reason => ({ reason, count: tips.filter(t => t.verified && t.reason === reason).length })).sort((a, b) => b.count - a.count)
      const topReason = reasons[0]?.count ? reasons[0].reason : null
      // Most recent verified tip overall — powers the "last tipped Xm ago" line.
      const lastTipAt = tips.reduce<number | null>(
        (latest, t) => (t.verified && (latest === null || t.timestamp > latest) ? t.timestamp : latest),
        null,
      )
      return { profile, totalNIM, recentNIM, recentTips, isNew, lastTipAt, topReason }
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

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const requestedReason = (await searchParams).reason
  const activeReason = (Object.keys(TIP_REASON_LABELS) as TipReason[]).includes(requestedReason as TipReason) ? requestedReason as TipReason : null
  const allWalls = await loadWalls()
  const walls = activeReason ? allWalls.filter(w => w.topReason === activeReason) : allWalls

  const trending = walls.filter(w => w.recentNIM > 0).slice(0, 3)
  const trendingHandles = new Set(trending.map(w => w.profile.handle))

  // "Just joined" — new walls with no verified tips yet. They can't rank, so
  // give them their own call-to-action section instead of burying them.
  // Newest first, capped to keep the front door from being flooded.
  const justJoined = walls
    .filter(w => w.isNew && w.totalNIM <= 0)
    .sort((a, b) => b.profile.createdAt - a.profile.createdAt)
    .slice(0, MAX_NEW_WALLS)
  const justJoinedHandles = new Set(justJoined.map(w => w.profile.handle))

  const rest = walls.filter(
    w => !trendingHandles.has(w.profile.handle) && !justJoinedHandles.has(w.profile.handle),
  )

  // Ecosystem totals: derived from the already-loaded array, no extra KV reads.
  const wallCount = walls.length
  const weekNIM = walls.reduce((sum, w) => sum + w.recentNIM, 0)

  return (
    <div className="app-shell min-h-screen text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">
            Find creators worth supporting
          </h1>
          <p className="max-w-xl mx-auto mt-2 text-sm text-slate-400">Browse by the kind of work people value, not just the amount raised.</p>
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
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 sm:justify-center">
            <Link href="/explore" className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${!activeReason ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-slate-700 text-slate-400 hover:text-white'}`}>All creators</Link>
            {(Object.keys(TIP_REASON_LABELS) as TipReason[]).map(reason => <Link key={reason} href={`/explore?reason=${reason}`} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${activeReason === reason ? 'border-sky-400 bg-sky-400/15 text-sky-200' : 'border-slate-700 text-slate-400 hover:text-white'}`}>{TIP_REASON_LABELS[reason].emoji} {TIP_REASON_LABELS[reason].label}</Link>)}
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
                  {trending.map(({ profile, totalNIM, recentNIM, isNew, lastTipAt, topReason }, i) => (
                    <a
                      key={profile.handle}
                      href={`/${profile.handle}`}
                      className="surface flex items-center gap-3 rounded-2xl hover:border-amber-400/50 p-4 sm:p-5 transition-colors"
                    >
                      <div
                        className={`flex-none flex items-center justify-center w-9 h-9 rounded-full font-bold text-base ${RANK_BADGE[i]}`}
                        aria-label={`Rank ${i + 1}`}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-amber-300 truncate flex items-center gap-2">
                          <span className="truncate">{profile.displayName || `@${profile.handle}`}</span>
                          {isNew && (
                            <span className="flex-none text-[10px] font-bold uppercase tracking-wide text-emerald-300 bg-emerald-400/15 border border-emerald-400/30 rounded-full px-1.5 py-0.5">
                              New
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 truncate">@{profile.handle}</p>
                        {profile.bio && (
                          <p className="text-sm text-slate-300 mt-1 line-clamp-2">{profile.bio}</p>
                        )}
                        {profile.achievement && (
                          <p className="text-xs text-amber-200/80 mt-1 truncate">🏆 {profile.achievement}</p>
                        )}
                        {topReason && <span className="inline-flex mt-2 items-center gap-1 text-[11px] text-sky-300 bg-sky-400/10 border border-sky-400/20 rounded-full px-2 py-0.5">{TIP_REASON_LABELS[topReason].emoji} {TIP_REASON_LABELS[topReason].label}</span>}
                      </div>
                      <div className="flex-none text-right">
                        <p className="text-lg font-bold text-amber-300 whitespace-nowrap">
                          {Math.round(recentNIM).toLocaleString()} NIM
                        </p>
                        <p className="text-xs text-slate-500">this week</p>
                        {lastTipAt !== null && (
                          <p className="text-xs text-emerald-400/80 mt-1 whitespace-nowrap">
                            ● tipped {timeAgo(lastTipAt)}
                          </p>
                        )}
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
                  {rest.map(({ profile, totalNIM, topReason }) => (
                    <a
                      key={profile.handle}
                      href={`/${profile.handle}`}
                      className="surface block rounded-2xl hover:border-amber-400/50 p-5 transition-colors"
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
                      {topReason && <span className="inline-flex mt-2 items-center gap-1 text-[11px] text-sky-300 bg-sky-400/10 border border-sky-400/20 rounded-full px-2 py-0.5">{TIP_REASON_LABELS[topReason].emoji} {TIP_REASON_LABELS[topReason].label}</span>}
                    </a>
                  ))}
                </div>
              </section>
            )}

            {justJoined.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-bold text-white">🌱 Just joined</h2>
                <p className="text-xs text-slate-500 mb-3">Be their first supporter</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {justJoined.map(({ profile }) => (
                    <a
                      key={profile.handle}
                      href={`/${profile.handle}`}
                      className="surface block rounded-2xl hover:border-emerald-400/50 p-5 transition-colors"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-bold text-amber-300 truncate">
                          {profile.displayName || `@${profile.handle}`}
                        </p>
                        <p className="shrink-0 text-xs font-semibold text-emerald-400">New</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">@{profile.handle}</p>
                      {profile.bio && (
                        <p className="text-sm text-slate-300 mt-2 line-clamp-2">{profile.bio}</p>
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
