import { afterEach, describe, expect, it, vi } from 'vitest'
import { NIMIQ_GET_NIM_URL, NIMIQ_PAY_LANDING_URL, platformSupportUrl } from '../environment'

afterEach(() => vi.unstubAllEnvs())

describe('Nimiq onboarding links', () => {
  it('separates wallet setup from acquiring NIM', () => {
    expect(NIMIQ_PAY_LANDING_URL).toBe('https://www.nimiq.com/nimiq-pay')
    expect(NIMIQ_GET_NIM_URL).toBe('https://www.nimiq.com/buy-and-sell')
  })
})

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
