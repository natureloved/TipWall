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
    })
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
