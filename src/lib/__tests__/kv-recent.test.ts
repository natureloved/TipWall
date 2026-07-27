import { describe, it, expect, vi, beforeEach } from 'vitest'

// getRecentVerifiedNim() reads the tip list via getTips() -> kv.lrange().
// Mock the underlying @vercel/kv client so we can feed arbitrary tip lists
// without a live KV, then assert the windowing/verification logic.
const lrange = vi.fn()
vi.mock('@vercel/kv', () => ({
  kv: {
    lrange: (...args: unknown[]) => lrange(...args),
  },
}))

import { getRecentVerifiedNim, LEADERBOARD_WINDOW_MS } from '../kv'
import type { Tip } from '../types'

const NOW = 1_700_000_000_000

function tip(partial: Partial<Tip>): Tip {
  return {
    id: 'id',
    handle: 'h',
    senderAddress: 'NQ00',
    amountNIM: 10,
    txHash: 'tx',
    verified: true,
    anonymous: false,
    timestamp: NOW,
    ...partial,
  }
}

/** Make getTips() return this list on the next call. */
function withTips(tips: Tip[]) {
  lrange.mockResolvedValueOnce(tips)
}

describe('getRecentVerifiedNim', () => {
  beforeEach(() => {
    lrange.mockReset()
  })

  it('sums only verified tips', async () => {
    withTips([
      tip({ amountNIM: 10, verified: true }),
      tip({ amountNIM: 5, verified: false }),
      tip({ amountNIM: 3, verified: true }),
    ])
    expect(await getRecentVerifiedNim('h', LEADERBOARD_WINDOW_MS, NOW)).toBe(13)
  })

  it('excludes tips older than the window', async () => {
    withTips([
      tip({ amountNIM: 10, timestamp: NOW }),
      tip({ amountNIM: 20, timestamp: NOW - LEADERBOARD_WINDOW_MS - 1 }),
    ])
    expect(await getRecentVerifiedNim('h', LEADERBOARD_WINDOW_MS, NOW)).toBe(10)
  })

  it('includes a tip exactly at the boundary (timestamp === now - windowMs)', async () => {
    withTips([tip({ amountNIM: 7, timestamp: NOW - LEADERBOARD_WINDOW_MS })])
    expect(await getRecentVerifiedNim('h', LEADERBOARD_WINDOW_MS, NOW)).toBe(7)
  })

  it('returns 0 for an empty list', async () => {
    withTips([])
    expect(await getRecentVerifiedNim('h', LEADERBOARD_WINDOW_MS, NOW)).toBe(0)
  })

  it('tolerates a missing amountNIM without producing NaN', async () => {
    withTips([
      tip({ amountNIM: undefined as unknown as number, verified: true }),
      tip({ amountNIM: 4, verified: true }),
    ])
    expect(await getRecentVerifiedNim('h', LEADERBOARD_WINDOW_MS, NOW)).toBe(4)
  })
})
