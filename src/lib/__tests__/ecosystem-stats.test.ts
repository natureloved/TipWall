import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
const set = vi.fn()
const del = vi.fn()
const smembers = vi.fn()
const mget = vi.fn()
const scard = vi.fn()
const lrange = vi.fn()

vi.mock('@vercel/kv', () => ({
  kv: {
    get: (...args: unknown[]) => get(...args),
    set: (...args: unknown[]) => set(...args),
    del: (...args: unknown[]) => del(...args),
    smembers: (...args: unknown[]) => smembers(...args),
    mget: (...args: unknown[]) => mget(...args),
    scard: (...args: unknown[]) => scard(...args),
    lrange: (...args: unknown[]) => lrange(...args),
  },
}))

import {
  getEcosystemStats,
  invalidateEcosystemStatsCache,
  ECOSYSTEM_STATS_CACHE_KEY,
} from '../kv'

beforeEach(() => {
  get.mockReset()
  set.mockReset()
  del.mockReset()
  smembers.mockReset()
  mget.mockReset()
  scard.mockReset()
  lrange.mockReset()
})

describe('getEcosystemStats caching and computation', () => {
  it('returns cached stats directly when present in KV', async () => {
    const cachedStats = {
      walls: 11,
      tippedCreators: 10,
      totalNIM: 19805,
      totalTips: 71,
      tipsThisWeek: 4,
      reasonCounts: { just_support: 54 },
    }
    get.mockResolvedValueOnce(cachedStats)

    const result = await getEcosystemStats()
    expect(result).toEqual(cachedStats)
    expect(get).toHaveBeenCalledWith(ECOSYSTEM_STATS_CACHE_KEY)
    expect(smembers).not.toHaveBeenCalled()
  })

  it('computes and caches stats when cache is missing', async () => {
    get.mockResolvedValueOnce(null) // cache miss
    smembers.mockResolvedValueOnce(['alice', 'bob'])
    // alice: tipped with 100 NIM (10_000_000 luna), bob: new untipped wall
    mget
      .mockResolvedValueOnce([10_000_000, 0]) // vtotals
      .mockResolvedValueOnce([
        { createdAt: Date.now() - 1000 },
        { createdAt: Date.now() - 1000 },
      ]) // profiles

    scard.mockResolvedValue(1) // alice vtxseen
    lrange.mockResolvedValueOnce([
      { verified: true, reason: 'just_support', timestamp: Date.now(), amountNIM: 100 },
    ]) // alice tips

    const result = await getEcosystemStats()
    expect(result.walls).toBe(2)
    expect(result.tippedCreators).toBe(1)
    expect(result.totalNIM).toBe(100)
    expect(result.totalTips).toBe(1)
    expect(result.tipsThisWeek).toBe(1)
    expect(result.reasonCounts).toEqual({ just_support: 1 })

    expect(set).toHaveBeenCalledWith(
      ECOSYSTEM_STATS_CACHE_KEY,
      expect.objectContaining({ walls: 2, totalNIM: 100 }),
      { ex: 300 },
    )
  })

  it('invalidates ecosystem stats cache on demand', async () => {
    await invalidateEcosystemStatsCache()
    expect(del).toHaveBeenCalledWith(ECOSYSTEM_STATS_CACHE_KEY)
  })
})
