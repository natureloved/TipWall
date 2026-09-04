import { afterEach, describe, expect, it, vi } from 'vitest'
import { getClientIp } from '../request'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getClientIp', () => {
  it('uses a shared identity when proxy trust is not configured', () => {
    expect(getClientIp(new Request('https://tipwall.test', {
      headers: { 'x-forwarded-for': '198.51.100.10', 'x-real-ip': '198.51.100.10' },
    }))).toBe('untrusted-proxy')
  })

  it('uses Vercel x-real-ip when the platform is trusted', () => {
    vi.stubEnv('VERCEL', '1')
    expect(getClientIp(new Request('https://tipwall.test', {
      headers: { 'x-forwarded-for': '198.51.100.10', 'x-real-ip': '203.0.113.7' },
    }))).toBe('203.0.113.7')
  })

  it('requires explicit trust before accepting forwarded headers', () => {
    vi.stubEnv('TIPWALL_TRUST_PROXY', '1')
    expect(getClientIp(new Request('https://tipwall.test', {
      headers: { 'x-forwarded-for': '198.51.100.10, 203.0.113.7' },
    }))).toBe('203.0.113.7')
  })
})
