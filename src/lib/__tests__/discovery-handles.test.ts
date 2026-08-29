import { beforeEach, describe, expect, it, vi } from 'vitest'

const zrange = vi.fn()
const smembers = vi.fn()
const keys = vi.fn()

vi.mock('@vercel/kv', () => ({
  kv: {
    zrange: (...args: unknown[]) => zrange(...args),
    smembers: (...args: unknown[]) => smembers(...args),
    keys: (...args: unknown[]) => keys(...args),
  },
}))

import { getDiscoveryHandles } from '../kv'

describe('getDiscoveryHandles', () => {
  beforeEach(() => {
    zrange.mockReset()
    smembers.mockReset()
    keys.mockReset()
  })

  it('keeps active walls first and completes the list from the profile registry', async () => {
    zrange.mockResolvedValue(['recent', 'shared'])
    smembers.mockResolvedValue(['shared', 'registered'])

    await expect(getDiscoveryHandles(4)).resolves.toEqual([
      'recent',
      'shared',
      'registered',
    ])
    expect(keys).not.toHaveBeenCalled()
  })

  it('uses legacy profile keys only when the canonical registry is empty', async () => {
    zrange.mockResolvedValue(['recent'])
    smembers.mockResolvedValue([])
    keys.mockResolvedValue(['tipwall:profile:legacy', 'tipwall:profile:recent'])

    await expect(getDiscoveryHandles()).resolves.toEqual(['recent', 'legacy'])
  })

  it('keeps durable candidates when the recent activity budget is full', async () => {
    zrange.mockResolvedValue(['stale-one', 'stale-two'])
    smembers.mockResolvedValue(['valid-creator'])
    keys.mockResolvedValue([])

    await expect(getDiscoveryHandles(2)).resolves.toEqual([
      'stale-one',
      'stale-two',
      'valid-creator',
    ])
    expect(zrange).toHaveBeenCalledWith('tipwall:active', 0, 1, { rev: true })
    expect(keys).not.toHaveBeenCalled()
  })

  it('uses the profile registry when the activity index is unavailable', async () => {
    zrange.mockRejectedValue(new Error('activity unavailable'))
    smembers.mockResolvedValue(['CreatorOne', 'creatorTwo'])
    keys.mockResolvedValue([])

    await expect(getDiscoveryHandles()).resolves.toEqual(['creatorone', 'creatortwo'])
  })

  it('returns an empty list only when every index was read successfully', async () => {
    zrange.mockResolvedValue([])
    smembers.mockResolvedValue([])
    keys.mockResolvedValue([])

    await expect(getDiscoveryHandles()).resolves.toEqual([])
  })

  it('reports an outage instead of presenting it as an empty directory', async () => {
    zrange.mockRejectedValue(new Error('activity unavailable'))
    smembers.mockRejectedValue(new Error('registry unavailable'))
    keys.mockRejectedValue(new Error('scan unavailable'))

    await expect(getDiscoveryHandles()).rejects.toThrow('scan unavailable')
  })
})
