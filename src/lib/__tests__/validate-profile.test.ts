import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { readdirSync } from 'node:fs'
import {
  validateHandle,
  validateContentUrl,
  clampProfileFields,
  isReservedHandle,
  BIO_MAX,
  DISPLAY_NAME_MAX,
  GOAL_TARGET_MAX,
  validatePolygonAddress,
  validateNotifyTelegram,
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

  /**
   * Guard against the class of bug where someone adds a route and forgets the
   * reserved list. A creator who registers that word gets a wall that the real
   * page silently shadows, and nothing errors - so only a test catches it.
   *
   * `launch` shipped unreserved and `roadmap` was added unreserved; both are
   * fixed, and this stops the next one.
   */
  it('reserves every top-level route segment that could be a handle', () => {
    const appDir = path.join(process.cwd(), 'src', 'app')
    // A handle can only contain these characters, so a segment with anything
    // else (e.g. `banner.png`) can never be produced by a handle and cannot
    // collide with one.
    const HANDLE_LEGAL = /^[a-z0-9_-]+$/

    const hasRouteFile = (dir: string): boolean =>
      readdirSync(dir, { withFileTypes: true }).some((entry) =>
        entry.isFile()
          ? /^(page|route)\.tsx?$/.test(entry.name)
          : entry.isDirectory() && !entry.name.startsWith('[') && hasRouteFile(path.join(dir, entry.name)),
      )

    const examined: string[] = []
    const missing: string[] = []

    for (const entry of readdirSync(appDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const segment = entry.name
      // `[handle]` is the dynamic segment itself; `_`-prefixed folders are
      // private to Next and never routable.
      if (segment.startsWith('[') || segment.startsWith('_')) continue
      if (!HANDLE_LEGAL.test(segment)) continue
      // A folder with no page/route file is not a route at all, so it cannot
      // shadow anything (e.g. the empty `mobile-modal-check` scratch folders).
      if (!hasRouteFile(path.join(appDir, segment))) continue
      examined.push(segment)
      if (!isReservedHandle(segment)) missing.push(segment)
    }

    expect(missing, `route segments missing from RESERVED_HANDLES: ${missing.join(', ')}`).toEqual([])
    // Prove the walker actually found routes, so a broken traversal cannot make
    // this test pass by examining nothing.
    expect(examined).toEqual(expect.arrayContaining(['api', 'explore', 'roadmap']))
  })
})

describe('validatePolygonAddress', () => {
  it('accepts optional empty values and strict EVM addresses', () => {
    expect(validatePolygonAddress('')).toBeNull()
    expect(validatePolygonAddress(`0x${'a'.repeat(40)}`)).toBeNull()
  })

  it('rejects malformed payout addresses', () => {
    expect(validatePolygonAddress('0x1234')).toMatch(/valid Polygon/)
    expect(validatePolygonAddress('not-an-address')).toMatch(/valid Polygon/)
  })
})

describe('validateNotifyTelegram', () => {
  it('requires a Telegram sendMessage URL with a chat id', () => {
    expect(validateNotifyTelegram('https://api.telegram.org/bot123:abc/sendMessage?chat_id=456')).toBeNull()
    expect(validateNotifyTelegram('https://api.telegram.org/bot123:abc')).toMatch(/sendMessage/)
    expect(validateNotifyTelegram('https://api.telegram.org/bot123:abc/sendMessage')).toMatch(/chat_id/)
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

  it('passes valid themes through and clamps unknown ones to paper', () => {
    expect(clampProfileFields({ theme: 'mint' }).theme).toBe('mint')
    expect(clampProfileFields({ theme: 'noir' }).theme).toBe('paper')
    expect(clampProfileFields({ theme: 42 }).theme).toBe('paper')
    expect(clampProfileFields({}).theme).toBeUndefined()
  })
})
