'use client'
// Share helpers used everywhere a wall can travel: the post-creation Share Kit,
// the post-tip supporter prompt, and milestone celebrations. Sharing is the
// app's only distribution channel — creators' own audiences — so every share
// surface funnels through here (consistent copy + WALL_SHARED tracking).

import { track } from './analytics'
import { wallUrl } from './environment'

export type ShareChannel = 'x' | 'telegram' | 'whatsapp' | 'native' | 'copy'

/** Pre-written post for a creator announcing their own wall. */
export function creatorShareText(): string {
  return `I just set up my TipWall — if my work has ever helped you, you can now tip me directly in NIM. No platform, no fees, straight to my wallet ⚡`
}

/** Post for a supporter who just tipped. */
export function supporterShareText(handle: string, amountNIM?: number): string {
  const amount = amountNIM ? `${amountNIM} NIM` : 'NIM'
  return `I just tipped @${handle} ${amount} on TipWall ⚡ Support them too:`
}

/** Post for a milestone crossing. */
export function milestoneShareText(handle: string, threshold: number): string {
  return `@${handle} just crossed ${threshold.toLocaleString()} NIM in tips on TipWall 🎉 Join the supporters:`
}

/** Web intent URLs for the channels the Nimiq community actually lives in. */
export function shareIntentUrl(channel: 'x' | 'telegram' | 'whatsapp', text: string, url: string): string {
  const t = encodeURIComponent(text)
  const u = encodeURIComponent(url)
  switch (channel) {
    case 'x':
      return `https://twitter.com/intent/tweet?text=${t}&url=${u}`
    case 'telegram':
      return `https://t.me/share/url?url=${u}&text=${t}`
    case 'whatsapp':
      return `https://wa.me/?text=${t}%20${u}`
  }
}

/** True when the Web Share API is available (mobile browsers, Nimiq Pay webview). */
export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/**
 * Open a share channel (or the native sheet) and record it in the creator's
 * funnel. Tracking is fire-and-forget; sharing must never fail because of it.
 */
export function openShare(channel: ShareChannel, handle: string, text: string, url: string): void {
  track(handle, 'WALL_SHARED')
  if (channel === 'copy') return // caller handles the clipboard write
  if (channel === 'native') {
    navigator.share({ text, url }).catch(() => {})
    return
  }
  window.open(shareIntentUrl(channel, text, url), '_blank', 'noopener,noreferrer')
}

export { wallUrl }
