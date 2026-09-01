import { describe, expect, it } from 'vitest'
import { parseExploreSort, sortWalls, wallMatches, type SortableWall } from '../explore'

function wall(overrides: Partial<SortableWall> & { handle: string; createdAt: number }): SortableWall {
  return {
    profile: { createdAt: overrides.createdAt },
    totalNIM: 0,
    recentNIM: 0,
    lastTipAt: null,
    ...overrides,
  }
}

describe('parseExploreSort', () => {
  it('accepts known sort keys', () => {
    expect(parseExploreSort('top')).toBe('top')
    expect(parseExploreSort('new')).toBe('new')
    expect(parseExploreSort('active')).toBe('active')
    expect(parseExploreSort('trending')).toBe('trending')
  })

  it('falls back to trending for unknown or missing values', () => {
    expect(parseExploreSort('bogus')).toBe('trending')
    expect(parseExploreSort(undefined)).toBe('trending')
    expect(parseExploreSort(['top'])).toBe('trending')
  })
})

describe('sortWalls', () => {
  const a = wall({ handle: 'a', createdAt: 100, totalNIM: 500, recentNIM: 10, lastTipAt: 1000 })
  const b = wall({ handle: 'b', createdAt: 300, totalNIM: 900, recentNIM: 40, lastTipAt: 3000 })
  const c = wall({ handle: 'c', createdAt: 200, totalNIM: 900, recentNIM: 40, lastTipAt: null })
  const d = wall({ handle: 'd', createdAt: 400, totalNIM: 0, recentNIM: 0, lastTipAt: null })

  it('trending sorts by recent NIM, tiebreak total', () => {
    // b and c fully tie (recent + total), and Array.prototype.sort is stable,
    // so the input order [a, d, c, b] keeps c ahead of b.
    expect(sortWalls([a, d, c, b], 'trending').map(w => w.profile.createdAt)).toEqual([200, 300, 100, 400])
  })

  it('top sorts by all-time NIM, tiebreak recent', () => {
    expect(sortWalls([a, b, d, c], 'top').map(w => w.profile.createdAt)).toEqual([300, 200, 100, 400])
  })

  it('new sorts by creation date, newest first', () => {
    expect(sortWalls([a, c, b, d], 'new').map(w => w.profile.createdAt)).toEqual([400, 300, 200, 100])
  })

  it('active sorts by last tip timestamp and sinks never-tipped walls', () => {
    expect(sortWalls([d, c, a, b], 'active').map(w => w.profile.createdAt)).toEqual([300, 100, 200, 400])
  })

  it('does not mutate the input array', () => {
    const input = [a, d, b, c]
    sortWalls(input, 'new')
    expect(input).toEqual([a, d, b, c])
  })
})

describe('wallMatches', () => {
  const w = {
    profile: {
      displayName: 'Nature Docs',
      handle: 'wildlife',
      bio: 'Films about birds',
      tags: ['Birds', 'Nature'],
    },
  }

  it('matches display name, handle and bio case-insensitively', () => {
    expect(wallMatches(w, 'nature', '')).toBe(true)
    expect(wallMatches(w, 'WILDLIFE', '')).toBe(true)
    expect(wallMatches(w, 'birds', '')).toBe(true)
  })

  it('rejects non-matching queries', () => {
    expect(wallMatches(w, 'crypto', '')).toBe(false)
  })

  it('matches walls with no display name or bio via handle', () => {
    const bare = { profile: { displayName: '', handle: 'solo', bio: '', tags: undefined as string[] | undefined } }
    expect(wallMatches(bare, 'solo', '')).toBe(true)
  })

  it('matches tags case-insensitively and rejects missing ones', () => {
    expect(wallMatches(w, '', 'nature')).toBe(true)
    expect(wallMatches(w, '', 'birds')).toBe(true)
    expect(wallMatches(w, '', 'gaming')).toBe(false)
  })

  it('combines query and tag filters', () => {
    expect(wallMatches(w, 'nature', 'birds')).toBe(true)
    expect(wallMatches(w, 'nature', 'gaming')).toBe(false)
    expect(wallMatches(w, 'crypto', 'birds')).toBe(false)
  })

  it('matches everything when both filters are empty', () => {
    expect(wallMatches(w, '', '')).toBe(true)
  })
})
