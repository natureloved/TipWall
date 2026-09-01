import type { CreatorProfile } from './types'

/**
 * New walls are surfaced for their first 48h even with no tips - a creator who
 * just signed up must be able to find themselves. After that, a wall needs at
 * least one verified tip to stay listed, so abandoned/test walls fall off.
 * Shared by the Explore listing rule and the site-wide ecosystem stats so the
 * two can never drift apart.
 */
export const NEW_WALL_GRACE_MS = 48 * 60 * 60 * 1000

export type ExploreSort = 'trending' | 'top' | 'new' | 'active'

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
