import Link from 'next/link'
import Image from 'next/image'
import {
  getDiscoveryHandles,
  getProfile,
  getVerifiedTotalNim,
  getTips,
  LEADERBOARD_WINDOW_MS,
} from '@/lib/kv'
import { TIP_REASON_LABELS, CREATOR_CATEGORIES, type CreatorProfile, type Tip, type TipReason, type CreatorCategory } from '@/lib/types'
import { EXPLORE_SORTS, NEW_WALL_GRACE_MS, parseExploreSort, sortWalls, wallMatches } from '@/lib/explore'
import MissionLink from '@/components/MissionLink'
import ExploreControls from '@/components/ExploreControls'
import { timeAgo } from '@/lib/time'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'TipWall | Most tipped creators this week',
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
  const handles = await getDiscoveryHandles(MAX_WALLS)

  const cutoff = Date.now() - LEADERBOARD_WINDOW_MS

  // Parallel: one Promise per wall, each fetching profile + tips in parallel.
  // getTips() is called once per wall; totalNIM and recentNIM both derive from it.
  const results = await Promise.all(
    handles.map(async (handle): Promise<{ wall: ExploreWall | null; failed: boolean }> => {
      try {
        const [profile, tips] = await Promise.all([
          getProfile(handle),
          getTips(handle),
        ])
        if (!profile) return { wall: null, failed: false }
        const totalNIM = await getVerifiedTotalNim(handle).catch(() => tips.reduce(
          (sum, tip) => sum + (tip.verified ? tip.amountNIM || 0 : 0),
          0,
        ))
        const isNew = Date.now() - profile.createdAt < NEW_WALL_GRACE_MS
        if (totalNIM <= 0 && !isNew) return { wall: null, failed: false }
        const recentNIM = tips.reduce(
          (sum: number, t: Tip) => (t.verified && t.timestamp >= cutoff ? sum + (t.amountNIM || 0) : sum),
          0,
        )
        const recentTips = tips.filter((t: Tip) => t.verified && t.timestamp >= cutoff).length
        const reasons = (Object.keys(TIP_REASON_LABELS) as TipReason[]).map(reason => ({ reason, count: tips.filter(t => t.verified && t.reason === reason).length })).sort((a, b) => b.count - a.count)
        const topReason = reasons[0]?.count ? reasons[0].reason : null
        // Most recent verified tip overall powers the activity line.
        const lastTipAt = tips.reduce<number | null>(
          (latest, t) => (t.verified && (latest === null || t.timestamp > latest) ? t.timestamp : latest),
          null,
        )
        return { wall: { profile, totalNIM, recentNIM, recentTips, isNew, lastTipAt, topReason }, failed: false }
      } catch {
        return { wall: null, failed: true }
      }
    }),
  )

  const walls = results.flatMap(result => result.wall ? [result.wall] : [])
  if (walls.length === 0 && results.some(result => result.failed)) {
    throw new Error('Creator directory data is unavailable')
  }

  // Sort: recentNIM desc, tiebreak by totalNIM desc
  walls.sort((a, b) => b.recentNIM - a.recentNIM || b.totalNIM - a.totalNIM)
  return walls.slice(0, MAX_WALLS)
}

const RANK_BADGE = [
  // 1st - gold, with a subtle glow
  'bg-[#F6B221] text-slate-900 shadow-lg shadow-amber-400/20',
  // 2nd - silver/slate
  'bg-slate-300 text-slate-900',
  // 3rd - bronze
  'bg-[#CD7F32] text-slate-900',
]

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string; tag?: string; sort?: string }> }) {
  const params = await searchParams
  const query = String(params.q || '').trim().toLowerCase()
  const activeTag = String(params.tag || '').trim().toLowerCase()
  const activeCategory = (Object.keys(CREATOR_CATEGORIES) as CreatorCategory[]).includes(params.cat as CreatorCategory) ? params.cat as CreatorCategory : null
  const activeSort = parseExploreSort(params.sort)
  let allWalls: ExploreWall[] = []
  let directoryUnavailable = false
  try {
    allWalls = await loadWalls()
  } catch (error) {
    directoryUnavailable = true
    console.error('Explore directory unavailable:', error)
  }
  const categoryWalls = activeCategory ? allWalls.filter(w => w.profile.category === activeCategory) : allWalls
  const walls = categoryWalls.filter(w => wallMatches(w, query, activeTag))
  const sortedWalls = sortWalls(walls, activeSort)
  const filtersActive = Boolean(query || activeTag || activeCategory)

  // Categories present in the directory power the filter chips (most walls first).
  const categoryCounts = new Map<CreatorCategory, number>()
  for (const w of allWalls) if (w.profile.category) {
    categoryCounts.set(w.profile.category, (categoryCounts.get(w.profile.category) || 0) + 1)
  }
  const categoryChips = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)

  // Most-used tags across the directory power the filter chips.
  const tagCounts = new Map<string, number>()
  for (const w of allWalls) for (const t of w.profile.tags || []) {
    const key = t.toLowerCase()
    tagCounts.set(key, (tagCounts.get(key) || 0) + 1)
  }
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t)

  const trending = sortedWalls.filter(w => w.recentNIM > 0).slice(0, 3)
  const trendingHandles = new Set(trending.map(w => w.profile.handle))

  // "Just joined" - new walls with no verified tips yet. They can't rank, so
  // give them their own call-to-action section instead of burying them.
  // Newest first, capped to keep the front door from being flooded.
  const justJoined = sortedWalls
    .filter(w => w.isNew && w.totalNIM <= 0)
    .sort((a, b) => b.profile.createdAt - a.profile.createdAt)
    .slice(0, MAX_NEW_WALLS)
  const justJoinedHandles = new Set(justJoined.map(w => w.profile.handle))

  const rest = sortedWalls.filter(
    w => !trendingHandles.has(w.profile.handle) && !justJoinedHandles.has(w.profile.handle),
  )

  // Ecosystem totals: derived from the already-loaded array, no extra KV reads.
  const wallCount = walls.length
  const weekNIM = walls.reduce((sum, w) => sum + w.recentNIM, 0)

  return (
    <div className="app-shell explore-page min-h-screen text-white px-4 py-10">
      <div className="w-full max-w-6xl mx-auto">
        <header className="explore-header explore-reveal flex flex-wrap items-center justify-between gap-3 mb-10 border-b border-slate-700 pb-4">
          <Link href="/" className="brand-logo-inline"><Image src="/logo.svg" alt="TipWall logo" width={34} height={34} />TipWall</Link>
          <Link href="/?create=1" className="explore-create-link rounded-full border px-4 py-2 text-sm font-bold">Create a wall</Link>
        </header>
        <div className="explore-hero explore-reveal text-center mb-8" style={{ animationDelay: '60ms' }}>
          <p className="landing-section-kicker mb-3">Creator discovery</p>
          <h1 className="font-serif text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900">
            Find creators worth <span className="text-amber-300 italic">supporting.</span>
          </h1>
          <p className="max-w-xl mx-auto mt-3 text-sm text-slate-400">Browse by the kind of work creators make, not just the amount raised.</p>
          {wallCount > 0 && (
            <p className="explore-stats-pill inline-flex mt-4 rounded-full border px-4 py-2 text-xs font-semibold">
              {wallCount.toLocaleString()} creator {wallCount === 1 ? 'wall' : 'walls'}
              {' · '}
              {Math.round(weekNIM).toLocaleString()} NIM tipped this week
            </p>
          )}
          <div className="mt-3">
            <MissionLink className="explore-mission-link" />
          </div>
          <ExploreControls
            query={query}
            activeCategory={activeCategory}
            activeTag={activeTag}
            activeSort={activeSort}
            categories={categoryChips}
            tags={topTags}
            disabled={directoryUnavailable}
          />
        </div>

        {directoryUnavailable ? (
          <div className="explore-empty explore-reveal mx-auto max-w-2xl rounded-2xl p-8 text-center sm:p-10" role="status" style={{ animationDelay: '120ms' }}>
            <h2 className="text-xl font-bold text-[#171614]">Creator walls are temporarily unavailable</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-[#5f574b]">
              Your walls and tips are safe. The creator directory could not reach its data service.
            </p>
            <form action="/explore" className="mt-5">
              <button type="submit" className="explore-bottom-cta rounded-xl px-5 py-2.5 text-sm font-bold">
                Try again
              </button>
            </form>
          </div>
        ) : walls.length === 0 ? (
          allWalls.length > 0 ? (
            <div className="explore-empty explore-reveal mx-auto max-w-2xl rounded-2xl p-8 text-center sm:p-10" role="status" style={{ animationDelay: '120ms' }}>
              <p className="text-4xl mb-3">🔍</p>
              <h2 className="text-xl font-bold text-[#171614]">No creators match those filters</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-[#5f574b]">Try a different search, or clear the filters to browse every wall.</p>
              <Link href="/explore" className="explore-bottom-cta inline-block mt-5 rounded-xl px-5 py-2.5 text-sm font-bold">Clear filters</Link>
            </div>
          ) : (
            <div className="explore-empty explore-reveal text-center rounded-2xl p-10" style={{ animationDelay: '120ms' }}>
              <p className="text-4xl mb-3">🌱</p>
              <p className="text-slate-300 font-semibold">No walls yet. Yours could be the first.</p>
            </div>
          )
        ) : (
          <>
            {filtersActive && (
              <p className="text-center text-xs font-semibold text-slate-500 mb-6">
                {sortedWalls.length} matching creator {sortedWalls.length === 1 ? 'wall' : 'walls'}
                {' · '}
                <Link href="/explore" className="underline hover:text-[#c4442d]">Clear filters</Link>
              </p>
            )}
            {activeSort === 'trending' ? (
              <>
            {/* Leaderboard - only when at least one wall has recent activity.
                Until tips start landing, this is empty and the flat grid below
                carries the page. */}
            {trending.length > 0 && (
              <section className="explore-section explore-reveal mb-8" style={{ animationDelay: '120ms' }}>
                <h2 className="flex items-center gap-2 text-lg font-bold text-white"><span className="explore-live-dot" aria-hidden="true" /> Most tipped this week</h2>
                <p className="text-xs text-slate-500 mb-3">Updated live · last 7 days</p>
                <div className="space-y-3">
                  {trending.map(({ profile, totalNIM, recentNIM, isNew, lastTipAt, topReason }, i) => (
                    <Link
                      key={profile.handle}
                      href={`/${profile.handle}`}
                      className="surface explore-card flex items-center gap-3 rounded-2xl hover:border-amber-400/50 p-4 sm:p-5"
                      style={{ animationDelay: `${180 + i * 70}ms` }}
                    >
                      <div
                        className={`explore-rank-badge flex-none flex items-center justify-center w-9 h-9 rounded-full font-bold text-base ${RANK_BADGE[i]}`}
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
                        {profile.category && <span className="inline-flex mt-2 items-center gap-1 text-[11px] text-amber-200 bg-amber-400/10 border border-amber-400/25 rounded-full px-2 py-0.5">{CREATOR_CATEGORIES[profile.category].emoji} {CREATOR_CATEGORIES[profile.category].label}</span>}
                        {topReason && <span className="inline-flex mt-2 ml-1 items-center gap-1 text-[11px] text-sky-300 bg-sky-400/10 border border-sky-400/20 rounded-full px-2 py-0.5">{TIP_REASON_LABELS[topReason].emoji} {TIP_REASON_LABELS[topReason].label}</span>}
                        {!!profile.tags?.length && (
                          <span className="mt-2 ml-1 inline-flex flex-wrap gap-1">
                            {profile.tags.map(tag => (
                              <span key={tag} className="text-[10px] font-semibold text-[#5f574b] bg-[#e9e2d2] border border-[#171614]/20 rounded-full px-2 py-0.5">#{tag}</span>
                            ))}
                          </span>
                        )}
                      </div>
                      <div className="flex-none text-right">
                        <p className="text-lg font-bold text-amber-300 whitespace-nowrap">
                          {Math.round(recentNIM).toLocaleString()} NIM
                        </p>
                        <p className="text-xs text-slate-500">this week</p>
                        {lastTipAt !== null && (
                          <p className="mt-1 whitespace-nowrap text-xs text-[#3f6f4d]">
                            ● tipped {timeAgo(lastTipAt)}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">
                          {Math.round(totalNIM).toLocaleString()} NIM all time
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {rest.length > 0 && (
              <section className="explore-section explore-reveal" style={{ animationDelay: '150ms' }}>
                {trending.length > 0 && (
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
                    More creator walls
                  </h2>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rest.map(({ profile, totalNIM, topReason }, i) => (
                    <Link
                      key={profile.handle}
                      href={`/${profile.handle}`}
                      className="surface explore-card block rounded-2xl hover:border-amber-400/50 p-5"
                      style={{ animationDelay: `${220 + Math.min(i, 8) * 65}ms` }}
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
                      {profile.category && <span className="inline-flex mt-2 items-center gap-1 text-[11px] text-amber-200 bg-amber-400/10 border border-amber-400/25 rounded-full px-2 py-0.5">{CREATOR_CATEGORIES[profile.category].emoji} {CREATOR_CATEGORIES[profile.category].label}</span>}
                      {topReason && <span className="inline-flex mt-2 ml-1 items-center gap-1 text-[11px] text-sky-300 bg-sky-400/10 border border-sky-400/20 rounded-full px-2 py-0.5">{TIP_REASON_LABELS[topReason].emoji} {TIP_REASON_LABELS[topReason].label}</span>}
                        {!!profile.tags?.length && (
                          <span className="mt-2 ml-1 inline-flex flex-wrap gap-1">
                            {profile.tags.map(tag => (
                              <span key={tag} className="text-[10px] font-semibold text-[#5f574b] bg-[#e9e2d2] border border-[#171614]/20 rounded-full px-2 py-0.5">#{tag}</span>
                            ))}
                          </span>
                        )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {justJoined.length > 0 && (
              <section className="explore-section explore-reveal mt-8" style={{ animationDelay: '180ms' }}>
                <h2 className="text-lg font-bold text-white">🌱 Just joined</h2>
                <p className="text-xs text-slate-500 mb-3">Be their first supporter</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {justJoined.map(({ profile }, i) => (
                    <Link
                      key={profile.handle}
                      href={`/${profile.handle}`}
                      className="surface explore-card block rounded-2xl hover:border-emerald-400/50 p-5"
                      style={{ animationDelay: `${250 + i * 65}ms` }}
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
                    </Link>
                  ))}
                </div>
              </section>
            )}
              </>
            ) : (
              <section className="explore-section explore-reveal" style={{ animationDelay: '120ms' }}>
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">{EXPLORE_SORTS[activeSort].label}</h2>
                <p className="text-xs text-slate-500 mb-3">{EXPLORE_SORTS[activeSort].hint}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedWalls.map(({ profile, totalNIM, isNew, lastTipAt }, i) => (
                    <Link
                      key={profile.handle}
                      href={`/${profile.handle}`}
                      className="surface explore-card block rounded-2xl hover:border-amber-400/50 p-5"
                      style={{ animationDelay: `${180 + Math.min(i, 8) * 65}ms` }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 font-bold text-amber-300 truncate">
                          {profile.displayName || `@${profile.handle}`}
                        </p>
                        {isNew ? (
                          <span className="flex-none text-[10px] font-bold uppercase tracking-wide text-emerald-300 bg-emerald-400/15 border border-emerald-400/30 rounded-full px-1.5 py-0.5">New</span>
                        ) : (
                          <p className="shrink-0 text-xs font-semibold text-emerald-400">
                            {Math.round(totalNIM).toLocaleString()} NIM
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">@{profile.handle}</p>
                      {profile.bio && (
                        <p className="text-sm text-slate-300 mt-2 line-clamp-2">{profile.bio}</p>
                      )}
                      {activeSort === 'active' && lastTipAt !== null && (
                        <p className="mt-2 text-xs text-[#3f6f4d]">● tipped {timeAgo(lastTipAt)}</p>
                      )}
                      {activeSort === 'new' && (
                        <p className="mt-2 text-xs text-slate-500">Joined {timeAgo(profile.createdAt)}</p>
                      )}
                      {profile.category && <span className="inline-flex mt-2 items-center gap-1 text-[11px] text-amber-200 bg-amber-400/10 border border-amber-400/25 rounded-full px-2 py-0.5">{CREATOR_CATEGORIES[profile.category].emoji} {CREATOR_CATEGORIES[profile.category].label}</span>}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <div className="text-center mt-10">
          <Link
            href="/?create=1"
            className="explore-bottom-cta inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-900 font-bold text-sm transition-all"
          >
            Create your own TipWall
          </Link>
        </div>
      </div>
    </div>
  )
}
