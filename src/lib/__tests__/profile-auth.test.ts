import { describe, it, expect } from 'vitest'
import {
  buildProfileAuthMessage,
  normalizeAddress,
  normalizeHandle,
} from '../profile-auth'

describe('normalizeAddress', () => {
  it('strips whitespace and uppercases', () => {
    expect(normalizeAddress('nq48 8ckh ba24 2vr3 n249 n8mn j5xx 74db u4jf')).toBe(
      'NQ488CKHBA242VR3N249N8MNJ5XX74DBU4JF',
    )
  })

  it('handles empty input', () => {
    expect(normalizeAddress('')).toBe('')
  })
})

describe('normalizeHandle', () => {
  it('lowercases and strips disallowed characters', () => {
    expect(normalizeHandle('My.Handle!123')).toBe('myhandle123')
  })

  it('keeps underscores and hyphens', () => {
    expect(normalizeHandle('a_b-c')).toBe('a_b-c')
  })
})

describe('buildProfileAuthMessage', () => {
  it('produces a stable canonical layout', () => {
    const msg = buildProfileAuthMessage({
      action: 'create',
      handle: 'Alice',
      walletAddress: 'nq48 8ckh ba24 2vr3 n249 n8mn j5xx 74db u4jf',
      issuedAt: 1700000000000,
    })
    expect(msg).toBe(
      [
        'TipWall account authorization',
        'action: create',
        'handle: alice',
        'wallet: NQ488CKHBA242VR3N249N8MNJ5XX74DBU4JF',
        'issued: 1700000000000',
      ].join('\n'),
    )
  })

  it('is ASCII-only so UTF-16 length equals byte length', () => {
    const msg = buildProfileAuthMessage({
      action: 'view',
      handle: 'bob',
      walletAddress: 'NQ48 8CKH',
      issuedAt: 1,
    })
    expect(new TextEncoder().encode(msg).length).toBe(msg.length)
  })
})
