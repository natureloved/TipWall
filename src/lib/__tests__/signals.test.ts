import { describe, expect, it } from 'vitest'
import { topReasonSignal } from '../signals'

describe('topReasonSignal', () => {
  it('returns null without counts or without verified tips', () => {
    expect(topReasonSignal(null, 10)).toBeNull()
    expect(topReasonSignal({}, 10)).toBeNull()
    expect(topReasonSignal({ helpful_content: 3 }, 0)).toBeNull()
  })

  it('picks the most common reason and computes its share of all tips', () => {
    const signal = topReasonSignal({ helpful_content: 6, tutorial: 2 }, 10)
    expect(signal).toEqual({
      reason: 'helpful_content',
      label: 'Helpful content',
      emoji: '💡',
      count: 6,
      total: 10,
      sharePct: 60,
    })
  })

  it('ignores unknown reasons and zero counts', () => {
    const signal = topReasonSignal({ bogus_reason: 9, just_support: 2 }, 4)
    expect(signal?.reason).toBe('just_support')
    expect(signal?.sharePct).toBe(50)
  })

  it('drops signals too small to be meaningful (<1%)', () => {
    expect(topReasonSignal({ great_idea: 1 }, 10_000)).toBeNull()
  })
})
