import { describe, it, expect } from 'vitest'
import { timeAgo, weekIndex, streakWeeks } from '../time'

describe('timeAgo', () => {
  const now = 1_700_000_000_000 // fixed reference so tests are deterministic
  const ago = (ms: number) => timeAgo(now - ms, now)

  const SEC = 1000
  const MIN = 60 * SEC
  const HOUR = 60 * MIN
  const DAY = 24 * HOUR
  const WEEK = 7 * DAY

  it('shows "just now" under a minute', () => {
    expect(ago(0)).toBe('just now')
    expect(ago(59 * SEC)).toBe('just now')
  })

  it('shows minutes under an hour', () => {
    expect(ago(MIN)).toBe('1m ago')
    expect(ago(59 * MIN)).toBe('59m ago')
  })

  it('shows hours under a day', () => {
    expect(ago(HOUR)).toBe('1h ago')
    expect(ago(23 * HOUR)).toBe('23h ago')
  })

  it('shows days under a week', () => {
    expect(ago(DAY)).toBe('1d ago')
    expect(ago(6 * DAY)).toBe('6d ago')
  })

  it('shows weeks beyond a week', () => {
    expect(ago(WEEK)).toBe('1w ago')
    expect(ago(3 * WEEK)).toBe('3w ago')
  })
})

describe('streaks', () => {
  const now = 1_700_000_000_000
  const thisWeek = weekIndex(now)
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000

  it('maps timestamps a week apart to consecutive indices', () => {
    expect(weekIndex(now) - weekIndex(now - WEEK_MS)).toBe(1)
    expect(weekIndex(now) - weekIndex(now - 3 * WEEK_MS)).toBe(3)
  })

  it('counts consecutive weeks ending now', () => {
    expect(streakWeeks([thisWeek, thisWeek - 1, thisWeek - 2], now)).toBe(3)
  })

  it('keeps the streak visible until a full week is missed', () => {
    expect(streakWeeks([thisWeek - 1, thisWeek - 2], now)).toBe(2)
  })

  it('breaks on gaps and returns 0 for empty history', () => {
    expect(streakWeeks([thisWeek, thisWeek - 2], now)).toBe(1)
    expect(streakWeeks([], now)).toBe(0)
  })
})
