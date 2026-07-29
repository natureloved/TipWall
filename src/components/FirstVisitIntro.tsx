'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslations } from '@/lib/i18n'
import { useFocusTrap } from '@/lib/useFocusTrap'

const SEEN_KEY = 'tipwall:intro-seen'

/**
 * Short educative modal shown the first time a visitor lands on a TipWall.
 * Gated by localStorage so it appears exactly once per browser and never
 * blocks returning users or the tipping flow.
 */
/**
 * Optional copy override. When omitted, the overlay uses the default first-visit
 * strings (introTitle/introBody/introMission/introPoint1-3). The home page passes
 * a `home` variant so its "Learn about TipWall" button shows a balanced,
 * creator-and-supporter write-up without changing the wall/explore overlay.
 */
export type IntroVariant = 'default' | 'home'

export default function FirstVisitIntro({ onClose, onStart, forceOpen = false, variant = 'default' }: { onClose: () => void; onStart?: () => void; forceOpen?: boolean; variant?: IntroVariant }) {
  // `show` starts false on both server and client to avoid hydration mismatch.
  // After mount we read localStorage once and flip it if needed.
  const [show, setShow] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const t = useTranslations()

  useFocusTrap(dialogRef, show)

  /* eslint-disable react-hooks/set-state-in-effect */
  // setState-in-effect is intentional: we must read localStorage after mount
  // to avoid a server/client hydration mismatch (server always renders false).
  useEffect(() => {
    if (forceOpen) { setShow(true); return }
    try {
      if (!localStorage.getItem(SEEN_KEY)) setShow(true)
    } catch { /* storage blocked — skip intro */ }
  }, [forceOpen])
  /* eslint-enable react-hooks/set-state-in-effect */

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

  // Home variant shows a balanced creator-and-supporter write-up; default keeps
  // the original first-visit copy used on walls and /explore.
  const k = variant === 'home'
    ? { title: 'homeIntroTitle', body: 'homeIntroBody', mission: 'homeIntroMission', p1: 'homeIntroPoint1', p2: 'homeIntroPoint2', p3: 'homeIntroPoint3' }
    : { title: 'introTitle', body: 'introBody', mission: 'introMission', p1: 'introPoint1', p2: 'introPoint2', p3: 'introPoint3' }

  const points = [t(k.p1), t(k.p2), t(k.p3)]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={dismiss}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t(k.title)}
        tabIndex={-1}
        className="w-full sm:max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto shadow-2xl border-t-2 sm:border-2 border-amber-400/20 animate-slide-up focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full mx-auto mb-6 sm:hidden" />

        <div className="text-center mb-5">
          <div className="text-4xl mb-2">⚡</div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">
            {t(k.title)}
          </h2>
          <p className="text-sm text-gray-300 mt-2">{t(k.body)}</p>
        </div>

        {/* Mission — the "why" behind TipWall, front and centre */}
        <div className="mb-5 rounded-xl bg-amber-400/10 border border-amber-400/25 px-4 py-3">
          <p className="text-[11px] font-bold text-amber-300 uppercase tracking-widest mb-1.5">Our mission</p>
          <p className="text-sm text-gray-200 leading-relaxed">{t(k.mission)}</p>
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
