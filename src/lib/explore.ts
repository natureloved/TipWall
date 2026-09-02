import type { CreatorProfile } from './types'

/**
 * New walls get a full week in the featured "new creators" lane. Verified-tip
 * rankings remain separate, so extending this window helps cold-start without
 * making an unearned popularity claim.
 */
export const NEW_WALL_GRACE_MS = 7 * 24 * 60 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

/** A minimal profile description keeps the featured cold-start lane useful. */
export function isProfileComplete(profile: Pick<CreatorProfile, 'bio' | 'achievement' | 'category' | 'contentUrl' | 'tags'>): boolean {
  return Boolean(
    profile.bio?.trim() ||
    profile.achievement?.trim() ||
    profile.category ||
    profile.contentUrl?.trim() ||
    profile.tags?.length,
  )
}

/**
 * Rotate a capped discovery lane without making the order jump on every
 * request. The same order is used for one day, then a different slice gets a
 * chance to be seen.
 */
export function rotateWallsDaily<T extends { profile: Pick<CreatorProfile, 'handle'> }>(walls: readonly T[], now = Date.now()): T[] {
  const day = Math.floor(now / DAY_MS)
  const score = (handle: string) => {
    let hash = 2166136261
    for (const char of `${day}:${handle.toLowerCase()}`) {
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
    }
    return hash >>> 0
  }
  return [...walls].sort((a, b) => score(a.profile.handle) - score(b.profile.handle))
}

export type ExploreSort = 'trending' | 'top' | 'new' | 'active'

export interface ExploreVisibilityWall {
  totalNIM: number
  isNew: boolean
  profileComplete: boolean
}

/**
 * Keep ranking views earned while allowing intentional discovery paths to
 * reach creators who have not received their first verified tip yet.
 */
export function includeWallInExplore(wall: ExploreVisibilityWall, sort: ExploreSort, filtersActive: boolean): boolean {
  if (sort === 'new' || filtersActive) return true
  if (sort === 'trending') return wall.totalNIM > 0 || (wall.isNew && wall.profileComplete)
  return wall.totalNIM > 0
}

export const EXPLORE_SORTS: Record<ExploreSort, { label: string; hint: string }> = {
  trending: { label: 'Trending', hint: 'Most tipped this week' },
  top: { label: 'Top all-time', hint: 'Most tipped overall' },
  new: { label: 'Newest', hint: 'Most recently created walls' },
  active: { label: 'Recently active', hint: 'Latest tips first' },
}

export function parseExploreSort(raw: string | string[] | undefined): ExploreSort {
  return typeof raw === 'string' && raw in EXPLORE_SORTS ? (raw as ExploreSort) : 'trending'
}

export interface SortableWall {
  profile: Pick<CreatorProfile, 'createdAt'>
  totalNIM: number
  recentNIM: number
  lastTipAt: number | null
}

export function sortWalls<T extends SortableWall>(walls: readonly T[], sort: ExploreSort): T[] {
  const sorted = [...walls]
  switch (sort) {
    case 'top':
      sorted.sort((a, b) => b.totalNIM - a.totalNIM || b.recentNIM - a.recentNIM)
      break
    case 'new':
      sorted.sort((a, b) => b.profile.createdAt - a.profile.createdAt || b.recentNIM - a.recentNIM)
      break
    case 'active':
      // Walls that never received a tip have no activity timestamp - sink them.
      sorted.sort((a, b) => (b.lastTipAt ?? 0) - (a.lastTipAt ?? 0) || b.recentNIM - a.recentNIM)
      break
    default:
      sorted.sort((a, b) => b.recentNIM - a.recentNIM || b.totalNIM - a.totalNIM)
  }
  return sorted
}

export interface MatchableWall {
  profile: Pick<CreatorProfile, 'displayName' | 'handle' | 'bio' | 'tags'>
}

/** Case-insensitive substring match over name/handle/bio, plus exact tag match. */
export function wallMatches(wall: MatchableWall, query: string, tag: string): boolean {
  if (query) {
    const haystack = `${wall.profile.displayName || ''} ${wall.profile.handle} ${wall.profile.bio || ''}`.toLowerCase()
    if (!haystack.includes(query.toLowerCase())) return false
  }
  if (tag && !(wall.profile.tags || []).some(t => t.toLowerCase() === tag)) return false
  return true
}
