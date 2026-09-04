import { beforeEach, describe, expect, it, vi } from 'vitest'

const zrange = vi.fn()
const smembers = vi.fn()
vi.mock('@vercel/kv', () => ({
  kv: {
    zrange: (...args: unknown[]) => zrange(...args),
    smembers: (...args: unknown[]) => smembers(...args),
  },
}))

import { getDiscoveryHandles } from '../kv'

describe('getDiscoveryHandles', () => {
  beforeEach(() => {
    zrange.mockReset()
    smembers.mockReset()
  })

  it('keeps active walls first and completes the list from the profile registry', async () => {
    zrange.mockResolvedValue(['recent', 'shared'])
    smembers.mockResolvedValue(['shared', 'registered'])

    await expect(getDiscoveryHandles(4)).resolves.toEqual([
      'recent',
      'shared',
      'registered',
    ])
  })

  it('uses only the durable profile registry when activity is present', async () => {
    zrange.mockResolvedValue(['recent'])
    smembers.mockResolvedValue([])

    await expect(getDiscoveryHandles()).resolves.toEqual(['recent'])
  })

  it('keeps durable candidates when the recent activity budget is full', async () => {
    zrange.mockResolvedValue(['stale-one', 'stale-two'])
    smembers.mockResolvedValue(['valid-creator'])
    await expect(getDiscoveryHandles(2)).resolves.toEqual([
      'stale-one',
      'stale-two',
      'valid-creator',
    ])
    expect(zrange).toHaveBeenCalledWith('tipwall:active', 0, 1, { rev: true })
  })

  it('uses the profile registry when the activity index is unavailable', async () => {
    zrange.mockRejectedValue(new Error('activity unavailable'))
    smembers.mockResolvedValue(['CreatorOne', 'creatorTwo'])
    await expect(getDiscoveryHandles()).resolves.toEqual(['creatorone', 'creatortwo'])
  })

  it('returns an empty list only when every index was read successfully', async () => {
    zrange.mockResolvedValue([])
    smembers.mockResolvedValue([])
    await expect(getDiscoveryHandles()).resolves.toEqual([])
  })

  it('reports an outage instead of presenting it as an empty directory', async () => {
    zrange.mockRejectedValue(new Error('activity unavailable'))
    smembers.mockRejectedValue(new Error('registry unavailable'))
    await expect(getDiscoveryHandles()).rejects.toThrow('registry unavailable')
  })
})
