import { describe, expect, it } from 'vitest'
import { buildRecentFeed } from '../feed'
import type { Tip } from '../types'

function tip(overrides: Partial<Tip>): Tip {
  return {
    id: 'tip-1',
    handle: 'maya',
    senderAddress: 'NQ11 0000 0000 0000 0000 0000 0000 0000 0000',
    senderName: 'Sam',
    reason: 'helpful_content',
    amountNIM: 10,
    txHash: '0xabc',
    verified: true,
    anonymous: false,
    timestamp: 1_700_000_000_000,
    ...overrides,
  }
}

describe('buildRecentFeed', () => {
  it('merges walls into one newest-first feed', () => {
    const feed = buildRecentFeed([
      { handle: 'maya', tips: [tip({ id: 'a', timestamp: 100 }), tip({ id: 'b', timestamp: 300 })] },
      { handle: 'obi', tips: [tip({ id: 'c', timestamp: 200 })] },
    ])
    expect(feed.map(f => f.id)).toEqual(['b', 'c', 'a'])
    expect(feed[0].handle).toBe('maya')
    expect(feed[1].handle).toBe('obi')
  })

  it('only includes verified tips', () => {
    const feed = buildRecentFeed([
      { handle: 'maya', tips: [tip({ id: 'ok' }), tip({ id: 'no', verified: false })] },
    ])
    expect(feed.map(f => f.id)).toEqual(['ok'])
  })

  it('never exposes sender identity for anonymous tips', () => {
    const feed = buildRecentFeed([
      { handle: 'maya', tips: [tip({ anonymous: true, senderName: 'Sam' })] },
    ])
    expect(feed[0].from).toBe('')
    expect(feed[0]).not.toHaveProperty('senderAddress')
    expect(feed[0]).not.toHaveProperty('txHash')
  })

  it('trims empty messages and respects the limit', () => {
    const tips = Array.from({ length: 12 }, (_, i) => tip({ id: `t${i}`, timestamp: i, message: i % 2 ? '   ' : `note ${i}` }))
    const feed = buildRecentFeed([{ handle: 'maya', tips }], 8)
    expect(feed).toHaveLength(8)
    expect(feed.find(f => f.id === 't10')?.message).toBe('note 10')
    expect(feed.find(f => f.id === 't11')?.message).toBeUndefined()
  })
})
