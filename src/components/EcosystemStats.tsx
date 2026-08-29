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
 */
export default function EcosystemStats() {
  const [stats, setStats] = useState<PublicEcosystemStats>(VERIFIED_ECOSYSTEM_STATS)

  useEffect(() => {
    let alive = true
    fetch('/api/stats/ecosystem')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setStats(withVerifiedEcosystemMinimum(d)) })
      .catch(() => { /* social proof is non-critical */ })
    return () => { alive = false }
  }, [])

  const items: { value: number; label: string; prefix?: string }[] = [
    { value: stats.walls, label: stats.walls === 1 ? 'wall' : 'walls' },
    { value: Math.round(stats.totalNIM), label: 'NIM tipped' },
    { value: stats.tippedCreators, label: stats.tippedCreators === 1 ? 'creator paid' : 'creators paid' },
  ].filter(i => i.value > 0)

  if (!items.length) return null

  return (
    <div
      className="mx-auto mb-10 w-full max-w-3xl animate-slide-up px-4"
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
