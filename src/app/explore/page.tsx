import Link from 'next/link'
import { kv } from '@vercel/kv'
import { getActiveHandles, getProfile, getVerifiedTotalNim } from '@/lib/kv'
import type { CreatorProfile } from '@/lib/types'

// Recently-active creator walls. In-ecosystem discovery is a supporting
// channel (creators' own audiences are the real one), but it gives new walls
// social proof and gives the Nimiq community a front door.
export const dynamic = 'force-dynamic'

const MAX_WALLS = 24
const PROFILE_PREFIX = 'tipwall:profile:'

type ExploreWall = {
  profile: CreatorProfile
  totalNIM: number
}

async function loadWalls(): Promise<ExploreWall[]> {
  let handles = await getActiveHandles(MAX_WALLS)

  if (handles.length < MAX_WALLS) {
    try {
      const keys = await kv.keys(`${PROFILE_PREFIX}*`)
      const allHandles = keys.map(k => k.slice(PROFILE_PREFIX.length))
      const seen = new Set(handles)
      const legacy = allHandles.filter(h => !seen.has(h))
      const needed = MAX_WALLS - handles.length
      handles = [...handles, ...legacy.slice(0, needed)]
    } catch {
      // Best effort — if KV keys() fails, just use the active set.
    }
  }

  const walls: ExploreWall[] = []
  for (const handle of handles.slice(0, MAX_WALLS)) {
    const profile = await getProfile(handle)
    if (!profile) continue
    walls.push({ profile, totalNIM: await getVerifiedTotalNim(handle) })
  }
  return walls
}

export default async function ExplorePage() {
  const walls = await loadWalls()

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">
            Explore TipWalls
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Recently active creator walls. Tip the creator. Not the platform.
          </p>
        </div>

        {walls.length === 0 ? (
          <div className="text-center rounded-2xl bg-slate-800 p-10">
            <p className="text-4xl mb-3">🌱</p>
            <p className="text-slate-300 font-semibold">No walls yet — yours could be the first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {walls.map(({ profile, totalNIM }) => (
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

export const metadata = {
  title: 'TipWall — Explore creator walls',
  description: 'Recently active creator tipping walls on Nimiq. Tip the creator. Not the platform.',
}
