'use client'
import { useEffect, useState } from 'react'
import AnimatedNumber from './AnimatedNumber'

type EcosystemStats = {
  walls: number
  tippedCreators: number
  totalNIM: number
  totalTips: number
}

/**
 * Live "the network is real" strip for the home page. Fetches site-wide totals
 * once on mount and counts them up. Renders nothing until real data arrives and
 * nothing at all if the ecosystem is empty - a fresh deploy should never greet a
 * first visitor with "0 walls · 0 NIM".
 */
export default function EcosystemStats() {
  const [stats, setStats] = useState<EcosystemStats | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/stats/ecosystem')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setStats(d) })
      .catch(() => { /* social proof is non-critical */ })
    return () => { alive = false }
  }, [])

  // Nothing to brag about yet - stay quiet rather than advertise an empty wall.
  if (!stats || (stats.walls === 0 && stats.totalTips === 0)) return null

  const items: { value: number; label: string; prefix?: string }[] = [
    { value: stats.walls, label: stats.walls === 1 ? 'wall' : 'walls' },
    { value: Math.round(stats.totalNIM), label: 'NIM tipped' },
    { value: stats.tippedCreators, label: stats.tippedCreators === 1 ? 'creator paid' : 'creators paid' },
  ].filter(i => i.value > 0)

  if (!items.length) return null

  return (
    <div
      className="w-full max-w-md mb-6 animate-slide-up"
      aria-label="TipWall network stats"
    >
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
