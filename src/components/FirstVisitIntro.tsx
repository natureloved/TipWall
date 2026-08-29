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

  useEffect(() => {
    if (!show) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [show])

  /* eslint-disable react-hooks/set-state-in-effect */
  // setState-in-effect is intentional: we must read localStorage after mount
  // to avoid a server/client hydration mismatch (server always renders false).
  useEffect(() => {
    if (forceOpen) { setShow(true); return }
    try {
      if (!localStorage.getItem(SEEN_KEY)) setShow(true)
    } catch { /* storage blocked - skip intro */ }
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={dismiss}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t(k.title)}
        tabIndex={-1}
        className="w-full max-h-[96dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t-2 border-[#f05a3c] bg-[#fffaf0] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-[#171614] shadow-[0_-10px_40px_rgba(23,22,20,0.22)] animate-slide-up focus:outline-none sm:max-w-md sm:rounded-2xl sm:border-2 sm:p-6 sm:pb-6 sm:shadow-[7px_7px_0_#171614]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-[#f05a3c] sm:hidden" />

        <div className="text-center mb-5">
          <div className="text-4xl mb-2">⚡</div>
          <h2 className="text-2xl font-bold text-[#b9382a]">
            {t(k.title)}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#5f574b]">{t(k.body)}</p>
        </div>

        {/* Mission - the "why" behind TipWall, front and centre */}
        <div className="mb-5 rounded-xl border border-[#ef9b88] bg-[#fff0eb] px-4 py-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-[#b9382a]">Our mission</p>
          <p className="text-sm leading-relaxed text-[#171614]">{t(k.mission)}</p>
        </div>

        <ul className="space-y-2 mb-6">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm leading-relaxed text-[#171614]">
              <span className="mt-0.5 shrink-0 font-bold text-[#3f6f4d]">✓</span>
              {p}
            </li>
          ))}
        </ul>

        {onStart ? (
          <div className="space-y-2">
            <button
              onClick={startTipping}
              className="min-h-12 w-full rounded-xl bg-[#171614] px-4 py-3.5 font-bold text-[#fffdf7] shadow-[3px_3px_0_#f05a3c] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#b9382a] hover:shadow-[4px_4px_0_#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0]"
            >
              💸 {t('sendTip')}
            </button>
            <button
              onClick={dismiss}
              className="min-h-11 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-[#5f574b] transition-colors hover:bg-[#f4f0e6] hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c]"
            >
              {t('introGotIt')}
            </button>
          </div>
        ) : (
          <button
            onClick={dismiss}
            className="min-h-12 w-full rounded-xl bg-[#171614] px-4 py-3.5 font-bold text-[#fffdf7] shadow-[3px_3px_0_#f05a3c] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#b9382a] hover:shadow-[4px_4px_0_#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0]"
          >
            {t('introGotIt')}
          </button>
        )}
      </div>
    </div>
  )
}
