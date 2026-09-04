import { describe, expect, it } from 'vitest'
import { localeDirection, resolveLocale, translate } from '../i18n'

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
