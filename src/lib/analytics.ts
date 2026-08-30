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

const KNOWN_REF_HOSTS: Record<string, string> = {
  'twitter.com': 'x', 'x.com': 'x', 'facebook.com': 'facebook', 'reddit.com': 'reddit',
  't.me': 'telegram', 'telegram.me': 'telegram', 'youtube.com': 'youtube', 'youtu.be': 'youtube',
  'github.com': 'github', 'bsky.app': 'bluesky', 'tiktok.com': 'tiktok',
  'linkedin.com': 'linkedin', 'instagram.com': 'instagram',
}

/**
 * Normalized traffic source for the referrer breakdown. utm_source wins;
 * otherwise a known referrer host maps to a short label, unknown hosts to
 * their registrable-ish name, and no referrer to 'direct'. Cardinality is
 * bounded by construction (charset + length caps).
 */
export function getRef(): string {
  if (typeof window === 'undefined') return 'direct'
  try {
    const utm = new URL(window.location.href).searchParams.get('utm_source')
    if (utm) return utm.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24) || 'other'
    if (!document.referrer) return 'direct'
    const host = new URL(document.referrer).hostname.replace(/^www\./, '').toLowerCase()
    if (KNOWN_REF_HOSTS[host]) return KNOWN_REF_HOSTS[host]
    const base = host.split('.').slice(-2, -1)[0] || host
    return base.replace(/[^a-z0-9.-]/g, '').slice(0, 24) || 'other'
  } catch {
    return 'direct'
  }
}

export function track(handle: string, event: FunnelEvent): void {
  if (typeof window === 'undefined' || !handle) return
  const body = JSON.stringify({ handle, event, cid: getClientId(), ref: getRef() })
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
