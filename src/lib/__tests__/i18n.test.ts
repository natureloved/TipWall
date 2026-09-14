import { afterEach, describe, expect, it, vi } from 'vitest'
import { localeDirection, nimiqPayLanguage, resolveLocale, translate } from '../i18n'

afterEach(() => { vi.unstubAllGlobals() })

describe('i18n primitives', () => {
  it('resolves supported language tags and falls back safely', () => {
    expect(resolveLocale('fr-CA,fr;q=0.9')).toBe('fr')
    expect(resolveLocale('ar')).toBe('en')
  })

  it('uses Intl plural categories and interpolates every occurrence', () => {
    expect(translate('en', 'suppTip', { count: 1, n: 1 })).toBe('1 tip')
    expect(translate('en', 'suppTip', { count: 2, n: 2 })).toBe('2 tips')
    expect(translate('en', 'statsNextMilestone', { n: 5, m: 10 })).toContain('5 NIM')
  })

  it('provides direction metadata for future RTL locales', () => {
    expect(localeDirection('ar')).toBe('rtl')
    expect(localeDirection('en')).toBe('ltr')
  })
})

describe('nimiqPayLanguage', () => {
  it('reads the language the Nimiq Pay host injected', () => {
    vi.stubGlobal('window', { nimiqPay: { language: 'de' } })
    expect(nimiqPayLanguage()).toBe('de')
  })

  it('returns null outside Nimiq Pay so callers fall back to the browser locale', () => {
    vi.stubGlobal('window', {})
    expect(nimiqPayLanguage()).toBeNull()
  })

  it('ignores a non-string host value', () => {
    vi.stubGlobal('window', { nimiqPay: { language: 42 } })
    expect(nimiqPayLanguage()).toBeNull()
  })
})
