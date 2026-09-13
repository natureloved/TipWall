import { describe, expect, it } from 'vitest'
import { VERIFIED_ECOSYSTEM_STATS, withVerifiedEcosystemMinimum } from '../public-snapshot'

describe('withVerifiedEcosystemMinimum', () => {
  it('restores the last verified totals when live data is unavailable', () => {
    expect(withVerifiedEcosystemMinimum(null)).toEqual(VERIFIED_ECOSYSTEM_STATS)
  })

  it('keeps newer cumulative live totals', () => {
    expect(withVerifiedEcosystemMinimum({
      walls: 40,
      tippedCreators: 12,
      totalNIM: 25_000,
      totalTips: 300,
    })).toEqual({
      walls: 40,
      tippedCreators: 12,
      totalNIM: 25_000,
      totalTips: 300,
      tipsThisWeek: 0,
      reasonCounts: {},
    })
  })

  // The weekly figure is a public claim about recent activity, so unlike the
  // cumulative totals it has no verified floor to fall back on - the only
  // honest floor is zero, and a live value must never be inflated by it.
  it('floors the weekly figure at zero and passes live values through', () => {
    expect(withVerifiedEcosystemMinimum({ tipsThisWeek: 0 }).tipsThisWeek).toBe(0)
    expect(withVerifiedEcosystemMinimum({ tipsThisWeek: 12 }).tipsThisWeek).toBe(12)
    expect(withVerifiedEcosystemMinimum(null).tipsThisWeek).toBe(0)
    expect(withVerifiedEcosystemMinimum({ tipsThisWeek: -5 }).tipsThisWeek).toBe(0)
  })

  it('passes live reason counts through for the signal card', () => {
    const result = withVerifiedEcosystemMinimum({
      walls: 40,
      tippedCreators: 12,
      totalNIM: 25_000,
      totalTips: 300,
      reasonCounts: { helpful_content: 7 },
    })
    expect(result.reasonCounts).toEqual({ helpful_content: 7 })
  })

  it('never regresses cumulative public figures', () => {
    expect(withVerifiedEcosystemMinimum({
      walls: 0,
      tippedCreators: 0,
      totalNIM: 0,
      totalTips: 0,
    })).toEqual(VERIFIED_ECOSYSTEM_STATS)
  })
})
