'use client'
import { useEffect, useState } from 'react'
import AnimatedNumber from './AnimatedNumber'
import {
  VERIFIED_ECOSYSTEM_STATS,
  withVerifiedEcosystemMinimum,
  type PublicEcosystemStats,
} from '@/lib/public-snapshot'


/**
 * Live "the network is real" strip for the home page. It starts from the last
 * verified cumulative snapshot, then counts up if the live endpoint is newer.
 *
 * Sized for the hero, where it sits directly under the trust claims and above
 * the fold. It used to render as a centred band at the bottom of the page with
 * a `compact` variant flag; that placement is gone, so the flag went with it.
 */
export default function EcosystemStats() {
  const [stats, setStats] = useState<PublicEcosystemStats>(VERIFIED_ECOSYSTEM_STATS)

  useEffect(() => {
    let alive = true
    let inFlight = false

    // A stale:true response is the route's fallback floor after a transient KV
    // error - retry briefly so one hiccup can't pin the strip on floor values.
    const load = async (remaining: number) => {
      if (inFlight) return
      inFlight = true
      try {
        const r = await fetch('/api/stats/ecosystem', { cache: 'no-store' })
        const d = r.ok ? await r.json() : null
        if (!alive) return
        if (d && !d.stale) {
          setStats(withVerifiedEcosystemMinimum(d))
          return
        }
      } catch { /* social proof is non-critical */ } finally {
        inFlight = false
      }
      if (alive && remaining > 1) setTimeout(() => load(remaining - 1), 2500)
    }

    load(3)

    // Poll every 12 seconds only when tab is visible to conserve Upstash commands & bandwidth
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return
      }
      load(1)
    }, 12_000)

    // Instantly refresh when the user switches back to this tab (e.g. after sending a tip)
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        load(1)
      }
    }
    window.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      alive = false
      clearInterval(interval)
      window.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  // Three distinct dimensions. The previous third slot was "walls supported",
  // which equals the wall count whenever every wall has been tipped at least
  // once - true for this network - so the panel read as if it had a bug.
  const tips = {
    value: stats.totalTips,
    label: stats.totalTips === 1 ? 'tip sent' : 'tips sent',
  }

  const items: { value: number; label: string }[] = [
    { value: stats.walls, label: stats.walls === 1 ? 'wall' : 'walls' },
    { value: Math.round(stats.totalNIM), label: 'NIM tipped' },
    tips,
  ].filter(i => i.value > 0)

  if (!items.length) return null

  return (
    <div className="mb-4 w-full animate-slide-up" aria-label="TipWall network stats">
      <div className="ecosystem-stats-panel flex items-stretch justify-center divide-x py-3">
        {items.map((item) => (
          <div key={item.label} className="flex-1 px-3 text-center">
            <p className="ecosystem-stat-value text-lg font-bold tabular-nums">
              <AnimatedNumber value={item.value} />
            </p>
            <p className="ecosystem-stat-label text-[11px] leading-tight mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
