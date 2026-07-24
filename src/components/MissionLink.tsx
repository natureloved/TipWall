'use client'
import { useState } from 'react'
import FirstVisitIntro from './FirstVisitIntro'
import { useTranslations } from '@/lib/i18n'

/**
 * A standalone "What is TipWall?" link that opens the mission overlay on demand.
 * Used on pages without a tipping context (e.g. /explore), so it's purely
 * educational — no onStart handler, the overlay just explains and dismisses.
 */
export default function MissionLink({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const t = useTranslations()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`text-sm text-amber-300/90 hover:text-amber-200 underline underline-offset-4 transition-colors ${className}`}
      >
        {t('whatIsTipWall')}
      </button>
      {open && <FirstVisitIntro forceOpen onClose={() => setOpen(false)} />}
    </>
  )
}
