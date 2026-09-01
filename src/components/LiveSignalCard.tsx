'use client'

import { useEffect, useState } from 'react'
import { topReasonSignal, type ReasonSignal } from '@/lib/signals'

type LiveStatsResponse = {
  totalTips?: number
  reasonCounts?: Record<string, number>
  stale?: boolean
}

/**
 * The home page's "What creators learn" card, driven by real aggregated tip
 * reasons instead of a hardcoded example. While loading, and whenever no
 * verified signal exists yet, it shows honest fallback copy - never invented
 * percentages.
 */
export default function LiveSignalCard() {
  const [signal, setSignal] = useState<ReasonSignal | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/stats/ecosystem')
        if (!res.ok) return
        const data: LiveStatsResponse = await res.json()
        if (!alive || data.stale) return
        setSignal(topReasonSignal(data.reasonCounts, Number(data.totalTips ?? 0) || 0))
      } catch {
        // keep the honest fallback card
      }
    })()
    return () => { alive = false }
  }, [])

  if (!signal) {
    return <div className="landing-signal-card">
      <span>LIVE SIGNAL</span>
      <strong>Every tip says why</strong>
      <div className="landing-signal-bar"><i /></div>
      <small>The top reason shows up here once real tips start landing</small>
    </div>
  }

  return <div className="landing-signal-card" style={{ '--signal-share': `${signal.sharePct}%` } as React.CSSProperties}>
    <span>LIVE SIGNAL</span>
    <strong>{signal.emoji} {signal.label}</strong>
    <div className="landing-signal-bar"><i /></div>
    <small>Most common reason · {signal.sharePct}% of {signal.total} tips so far</small>
  </div>
}
