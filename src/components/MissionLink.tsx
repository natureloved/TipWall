'use client'
import { useState } from 'react'
import FirstVisitIntro, { type IntroVariant } from './FirstVisitIntro'
import { useTranslations } from '@/lib/i18n'

/**
 * A standalone link that opens the mission overlay on demand. Used on pages
 * without a tipping context (e.g. /explore, home), so it's purely educational —
 * no onStart handler, the overlay just explains and dismisses.
 *
 * `labelKey` picks the button text and `variant` picks the overlay copy, so the
 * home hero can read "Learn about TipWall" with a balanced write-up while
 * /explore keeps the shorter "What is TipWall?" default.
 */
export default function MissionLink({ className = '', labelKey = 'whatIsTipWall', variant = 'default' }: { className?: string; labelKey?: string; variant?: IntroVariant }) {
  const [open, setOpen] = useState(false)
  const t = useTranslations()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`text-sm text-amber-300/90 hover:text-amber-200 underline underline-offset-4 transition-colors ${className}`}
      >
        {t(labelKey)}
      </button>
      {open && <FirstVisitIntro forceOpen variant={variant} onClose={() => setOpen(false)} />}
    </>
  )
}
