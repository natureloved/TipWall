'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TIP_REASON_LABELS } from '@/lib/types'
import type { FeedItem } from '@/lib/feed'

type RecentFeedResponse = { items?: FeedItem[]; stale?: boolean }

function describeTip(item: FeedItem): string {
  const who = item.from || 'Someone'
  const reason = item.reason ? TIP_REASON_LABELS[item.reason]?.label : undefined
  return reason
    ? `${who} tipped ${item.amountNIM} NIM for "${reason}" to @${item.handle}`
    : `${who} tipped ${item.amountNIM} NIM to @${item.handle}`
}

const FALLBACK_PHRASE = 'SUPPORT SOMEONE · SAY WHY IT MATTERED · LEAVE A MARK · '
// 8 repeats (~472 chars / ~3500px) ensures full seamless coverage across wide monitors
const FALLBACK_TEXT = FALLBACK_PHRASE.repeat(8)

/**
 * Real network activity in the homepage ticker slot. While loading, on
 * error, or before the first verified tips exist, it falls back to the
 * classic slogan marquee so the band never looks broken.
 */
export default function RecentActivity() {
  const [items, setItems] = useState<FeedItem[] | null>(null)

  useEffect(() => {
    let alive = true
    const loadActivity = async () => {
      try {
        const res = await fetch('/api/feed/recent', { cache: 'no-store' })
        if (!res.ok) return
        const data: RecentFeedResponse = await res.json()
        if (alive && !data.stale) setItems(data.items ?? [])
      } catch {
        // keep the classic ticker
      }
    }
    loadActivity()
    const interval = setInterval(loadActivity, 60_000)
    return () => { alive = false; clearInterval(interval) }
  }, [])

  if (!items || items.length === 0) {
    return (
      <div className="landing-ticker" role="region" aria-label="Support slogan marquee">
        <span>{FALLBACK_TEXT}</span>
        <span aria-hidden="true">{FALLBACK_TEXT}</span>
      </div>
    )
  }

  let text = `${items.map(describeTip).join('  ·  ')}  ·  `
  while (text.length < 350) {
    text += text
  }
  // Longer strips need longer loops so the text stays readable (~50px/sec).
  const duration = Math.min(120, Math.max(30, Math.round(text.length * 0.16)))

  return (
    <Link
      href="/explore"
      className="landing-ticker landing-ticker-live"
      style={{ '--tick-duration': `${duration}s` } as React.CSSProperties}
      aria-label="Recent tips across TipWall. Browse every wall"
    >
      <span>{text}</span>
      <span aria-hidden="true">{text}</span>
    </Link>
  )
}
