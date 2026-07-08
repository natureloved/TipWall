import { describe, it, expect } from 'vitest'
import {
  validateHandle,
  validateContentUrl,
  clampProfileFields,
  isReservedHandle,
  BIO_MAX,
  DISPLAY_NAME_MAX,
  GOAL_TARGET_MAX,
} from '../validate-profile'

describe('validateHandle', () => {
  it('accepts a normal handle', () => {
    expect(validateHandle('alice')).toBeNull()
  })

  it('rejects too-short and too-long handles', () => {
    expect(validateHandle('ab')).toMatch(/at least/)
    expect(validateHandle('a'.repeat(33))).toMatch(/at most/)
  })

  it('rejects reserved handles that would shadow routes', () => {
    for (const reserved of ['api', 'claim', 'sitemap', '_next', 'dashboard', 'admin']) {
      expect(validateHandle(reserved), reserved).toMatch(/reserved/)
      expect(isReservedHandle(reserved)).toBe(true)
    }
  })
})

describe('validateContentUrl', () => {
  it('accepts empty and normal http(s) URLs', () => {
    expect(validateContentUrl('')).toBeNull()
    expect(validateContentUrl('https://example.com/post')).toBeNull()
    expect(validateContentUrl('http://example.com')).toBeNull()
  })

  it('rejects non-http protocols and garbage', () => {
    expect(validateContentUrl('javascript:alert(1)')).toMatch(/http/)
    expect(validateContentUrl('ftp://example.com')).toMatch(/http/)
    expect(validateContentUrl('not a url')).toMatch(/valid/)
  })

  it('rejects oversized URLs', () => {
    expect(validateContentUrl(`https://example.com/${'a'.repeat(600)}`)).toMatch(/long/)
  })
})

describe('clampProfileFields', () => {
  it('caps oversized fields instead of storing them verbatim', () => {
    const out = clampProfileFields({
      displayName: 'x'.repeat(500),
      bio: 'y'.repeat(5000),
      achievement: 'z'.repeat(500),
      goal: { label: 'L'.repeat(500), targetNIM: 10 ** 15 },
    })
    expect(out.displayName!.length).toBe(DISPLAY_NAME_MAX)
    expect(out.bio!.length).toBe(BIO_MAX)
    expect(out.goal!.targetNIM).toBe(GOAL_TARGET_MAX)
  })

  it('leaves undefined fields undefined (partial updates)', () => {
    const out = clampProfileFields({ bio: 'hello' })
    expect(out.bio).toBe('hello')
    expect(out.displayName).toBeUndefined()
    expect(out.goal).toBeUndefined()
  })

  it('defaults a malformed goal target to something sane', () => {
    const out = clampProfileFields({ goal: { label: 'Goal', targetNIM: 'NaNaNaN' } })
    expect(out.goal!.targetNIM).toBe(1000)
  })
})
