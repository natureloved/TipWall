import { beforeEach, describe, expect, it, vi } from 'vitest'

const smembers = vi.fn()
const get = vi.fn()

vi.mock('@vercel/kv', () => ({
  kv: {
    smembers: (...args: unknown[]) => smembers(...args),
    get: (...args: unknown[]) => get(...args),
  },
}))

import { getProfilesByWallet } from '../kv'

beforeEach(() => {
  smembers.mockReset()
  get.mockReset()
})

describe('wallet profile index', () => {
  it('returns every owned handle in deterministic creation order', async () => {
    smembers.mockResolvedValue(['later', 'first'])
    get.mockImplementation(async (key: string) => {
      if (key.startsWith('tipwall:wallet:')) return ['first', 'legacy']
      if (key === 'tipwall:profile:first') return { handle: 'first', walletAddress: 'NQ', createdAt: 1 }
      if (key === 'tipwall:profile:legacy') return { handle: 'legacy', walletAddress: 'NQ', createdAt: 2 }
      if (key === 'tipwall:profile:later') return { handle: 'later', walletAddress: 'NQ', createdAt: 3 }
      return null
    })

    const profiles = await getProfilesByWallet('NQ 00')
    expect(profiles.map(profile => profile.handle)).toEqual(['first', 'legacy', 'later'])
  })
})
