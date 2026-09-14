'use client'

import { useEffect } from 'react'
import { localeDirection, nimiqPayLanguage, resolveLocale } from '@/lib/i18n'

/** Keep document language and direction aligned with the detected UI locale. */
export default function LocaleDocument() {
  useEffect(() => {
    // Prefer the Nimiq Pay host language so the document matches the UI locale.
    const locale = resolveLocale(nimiqPayLanguage() || navigator.languages?.[0] || navigator.language)
    document.documentElement.lang = locale
    document.documentElement.dir = localeDirection(locale)
  }, [])
  return null
}
