'use client'
import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from '@/lib/i18n'

const SEEN_KEY = 'tipwall:intro-seen'

/**
 * Short educative modal shown the first time a visitor lands on a TipWall.
 * Gated by localStorage so it appears exactly once per browser and never
 * blocks returning users or the tipping flow.
 */
export default function FirstVisitIntro({ onClose, onStart }: { onClose: () => void; onStart?: () => void }) {
  // `show` starts false on both server and client, so there's no hydration
  // mismatch. localStorage is only read after mount inside the effect.
  const [show, setShow] = useState(false)
  const t = useTranslations()

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(SEEN_KEY)) setShow(true)
    } catch {
      /* storage blocked — skip intro */
    }
  }, [])

  const dismiss = useCallback(() => {
    try { localStorage.setItem(SEEN_KEY, '1') } catch { /* ignore */ }
    setShow(false)
    onClose()
  }, [onClose])

  const startTipping = useCallback(() => {
    dismiss()
    onStart?.()
  }, [dismiss, onStart])

  // Close on Escape (keyboard accessibility).
  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show, dismiss])

  if (!show) return null

  const points = [t('introPoint1'), t('introPoint2'), t('introPoint3')]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={dismiss}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('introTitle')}
        className="w-full sm:max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto shadow-2xl border-t-2 sm:border-2 border-amber-400/20 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full mx-auto mb-6 sm:hidden" />

        <div className="text-center mb-5">
          <div className="text-4xl mb-2">⚡</div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">
            {t('introTitle')}
          </h2>
          <p className="text-sm text-gray-300 mt-2">{t('introBody')}</p>
        </div>

        <ul className="space-y-2 mb-6">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm text-gray-200">
              <span className="text-emerald-400">✓</span>
              {p}
            </li>
          ))}
        </ul>

        {onStart ? (
          <div className="space-y-2">
            <button
              onClick={startTipping}
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-bold rounded-xl shadow-lg hover:shadow-xl hover:from-amber-500 hover:to-amber-600 transition-all duration-300"
            >
              💸 {t('sendTip')}
            </button>
            <button
              onClick={dismiss}
              className="w-full py-2.5 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
            >
              {t('introGotIt')}
            </button>
          </div>
        ) : (
          <button
            onClick={dismiss}
            className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-bold rounded-xl shadow-lg hover:shadow-xl hover:from-amber-500 hover:to-amber-600 transition-all duration-300"
          >
            {t('introGotIt')}
          </button>
        )}
      </div>
    </div>
  )
}
