import { beforeEach, describe, expect, it, vi } from 'vitest'

const scard = vi.fn()
const lrange = vi.fn()
const get = vi.fn()
const sadd = vi.fn()
const hgetall = vi.fn()
const keys = vi.fn()

vi.mock('@vercel/kv', () => ({
  kv: {
    scard: (...args: unknown[]) => scard(...args),
    lrange: (...args: unknown[]) => lrange(...args),
    get: (...args: unknown[]) => get(...args),
    sadd: (...args: unknown[]) => sadd(...args),
    hgetall: (...args: unknown[]) => hgetall(...args),
    keys: (...args: unknown[]) => keys(...args),
  },
}))

import { getTopRefs, getVerifiedTipCount } from '../kv'

beforeEach(() => {
  scard.mockReset()
  lrange.mockReset()
  get.mockReset()
  sadd.mockReset()
  hgetall.mockReset()
  keys.mockReset()
})

describe('read-only aggregates', () => {
  it('reads the verified count without backfilling the set', async () => {
    scard.mockResolvedValue(7)

    await expect(getVerifiedTipCount('alice')).resolves.toBe(7)
    expect(lrange).not.toHaveBeenCalled()
    expect(sadd).not.toHaveBeenCalled()
  })

  it('uses a pure list fallback for legacy walls', async () => {
    scard.mockResolvedValue(0)
    lrange.mockResolvedValue([
      { verified: true, txHash: 'a' },
      { verified: true, txHash: 'a' },
      { verified: false, txHash: 'b' },
      { verified: true, txHash: 'c' },
    ])

    await expect(getVerifiedTipCount('legacy')).resolves.toBe(2)
    expect(sadd).not.toHaveBeenCalled()
  })

  it('does not seed the lifetime total from a GET', async () => {
    get.mockResolvedValue(null)
    lrange.mockResolvedValue([{ verified: true, amountNIM: 12 }])

    const { getVerifiedTotalNim } = await import('../kv')
    await expect(getVerifiedTotalNim('legacy')).resolves.toBe(12)
    expect(sadd).not.toHaveBeenCalled()
  })

  it('reads referrer rankings from one hash instead of scanning keys', async () => {
    hgetall.mockResolvedValue({ telegram: '5', github: 2, other: '1' })

    await expect(getTopRefs('alice', 'TIP_WALL_VIEWED')).resolves.toEqual([
      { ref: 'telegram', count: 5 },
      { ref: 'github', count: 2 },
      { ref: 'other', count: 1 },
    ])
    expect(keys).not.toHaveBeenCalled()
  })
})
