'use client'
import { useEffect, useRef, useState } from 'react'
import { TIP_REASON_LABELS, type TipReason } from '@/lib/types'

type LiveTip = {
  id: string
  amountNIM: number
  message?: string
  reason?: TipReason
  senderName?: string
  anonymous: boolean
  timestamp: number
}

const POLL_MS = 5000
const ALERT_MS = 8000

/**
 * OBS browser-source overlay: transparent page that pops an animated sticky
 * note whenever a new tip lands. Add as a Browser Source (1920x1080) in OBS.
 */
export default function OverlayClient({ handle }: { handle: string }) {
  const [alert, setAlert] = useState<LiveTip | null>(null)
  const lastHead = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch(`/api/tips/${handle}/live`)
        if (!res.ok) return
        const data = (await res.json()) as { headTipId: string | null; latest: LiveTip | null }
        if (cancelled) return
        if (lastHead.current === null) {
          // First poll establishes the baseline without replaying old tips.
          lastHead.current = data.headTipId
          return
        }
        if (data.headTipId && data.headTipId !== lastHead.current && data.latest) {
          lastHead.current = data.headTipId
          setAlert(data.latest)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => setAlert(null), ALERT_MS)
        }
      } catch {
        // Overlay must never throw - a missed poll just retries.
      }
    }

    poll()
    const interval = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(interval); if (timer.current) clearTimeout(timer.current) }
  }, [handle])

  return (
    <>
      {/* OBS browser source needs a transparent page, not the paper theme. */}
      <style>{'html,body{background:transparent !important}'}</style>
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-live="polite">
        {alert && (
          <div className="overlay-note absolute left-10 bottom-10 w-[380px] max-w-[80vw]">
            <div className="tip-note-card !p-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-base font-bold text-[#171614]">
                  {alert.anonymous ? '️ Anonymous' : alert.senderName || 'A supporter'}
                </span>
                <span className="shrink-0 text-xl font-black text-[#171614]">{alert.amountNIM} NIM</span>
              </div>
              {alert.reason && (
                <p className="mt-1 text-xs font-semibold text-[#5f574b]">
                  {TIP_REASON_LABELS[alert.reason].emoji} {TIP_REASON_LABELS[alert.reason].label}
                </p>
              )}
              {alert.message && <p className="mt-2 text-sm leading-snug text-[#171614]">“{alert.message}”</p>}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
