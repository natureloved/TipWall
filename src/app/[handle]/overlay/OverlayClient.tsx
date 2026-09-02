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
  const [queue, setQueue] = useState<LiveTip[]>([])
  const lastHead = useRef<string | null>(null)
  const initialized = useRef(false)
  const alertId = queue[0]?.id
  const alert = queue[0] || null

  // Play one alert at a time so a burst of tips remains legible on stream.
  useEffect(() => {
    if (!alertId) return
    const timer = setTimeout(() => setQueue(current => current.slice(1)), ALERT_MS)
    return () => clearTimeout(timer)
  }, [alertId])

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const cursor = lastHead.current
        const query = cursor ? `?after=${encodeURIComponent(cursor)}` : ''
        const res = await fetch(`/api/tips/${handle}/live${query}`)
        if (!res.ok) return
        const data = (await res.json()) as { headTipId: string | null; latest: LiveTip | null; newTips?: LiveTip[] }
        if (cancelled) return
        if (!initialized.current) {
          // First poll establishes the baseline without replaying old tips.
          lastHead.current = data.headTipId
          initialized.current = true
          return
        }
        if (data.headTipId && data.headTipId !== lastHead.current && data.latest) {
          lastHead.current = data.headTipId
          const incoming = data.newTips?.length ? [...data.newTips].reverse() : [data.latest]
          setQueue(current => [...current, ...incoming].slice(-20))
        }
      } catch {
        // Overlay must never throw - a missed poll just retries.
      }
    }

    poll()
    const interval = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [handle])

  return (
    <>
      {/* OBS browser source needs a transparent page, not the paper theme. */}
      <style>{'html,body{background:transparent !important}'}</style>
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-live="polite">
        {alert && (
          <div key={`${alert.id}-${alert.timestamp}`} className="overlay-note absolute left-10 bottom-10 w-[380px] max-w-[80vw]">
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
