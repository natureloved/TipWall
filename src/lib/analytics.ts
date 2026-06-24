'use client'
// Lightweight, fire-and-forget client for the conversion funnel. Sends an
// anonymous client id (random, stored locally) so the server can dedupe views
// without any PII. Never blocks the UI and never throws.

import type { FunnelEvent } from './events'

const CID_KEY = 'tipwall:cid'

/** Stable anonymous client id for view dedup. Not tied to wallet/identity. */
export function getClientId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let cid = window.localStorage.getItem(CID_KEY)
    if (!cid) {
      cid = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`)
      window.localStorage.setItem(CID_KEY, cid)
    }
    return cid
  } catch {
    return ''
  }
}

export function track(handle: string, event: FunnelEvent): void {
  if (typeof window === 'undefined' || !handle) return
  const body = JSON.stringify({ handle, event, cid: getClientId() })
  try {
    // Prefer sendBeacon so events survive navigation (e.g. tapping a deep link).
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/stats/track', new Blob([body], { type: 'application/json' }))
      return
    }
  } catch {
    /* fall through to fetch */
  }
  fetch('/api/stats/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}
