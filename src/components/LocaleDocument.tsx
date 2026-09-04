'use client'

import { useEffect } from 'react'
import { localeDirection, resolveLocale } from '@/lib/i18n'

/** Keep document language and direction aligned with the detected UI locale. */
export default function LocaleDocument() {
  useEffect(() => {
    const locale = resolveLocale(navigator.languages?.[0] || navigator.language)
    document.documentElement.lang = locale
    document.documentElement.dir = localeDirection(locale)
  }, [])
  return null
}
