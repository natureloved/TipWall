import { afterEach, describe, expect, it, vi } from 'vitest'
import { platformSupportUrl } from '../environment'

afterEach(() => vi.unstubAllEnvs())

describe('platformSupportUrl', () => {
  it('returns a configured web funding link', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPPORT_URL', 'https://github.com/sponsors/tipwall')
    expect(platformSupportUrl()).toBe('https://github.com/sponsors/tipwall')
  })

  it('hides missing or non-web funding links', () => {
    expect(platformSupportUrl()).toBe('')
    vi.stubEnv('NEXT_PUBLIC_SUPPORT_URL', 'javascript:alert(1)')
    expect(platformSupportUrl()).toBe('')
  })
})
