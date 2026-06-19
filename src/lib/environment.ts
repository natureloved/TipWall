// Client-side helpers for detecting the Nimiq Pay environment and building the
// deep links / store links used by the onboarding (tip recovery) flow.
//
// A tip can only be COMPLETED inside Nimiq Pay (that is where the wallet lives).
// So when we are outside Nimiq Pay we must guide the user into it rather than
// attempting a payment that can never succeed.

import { init } from '@nimiq/mini-app-sdk'

export const NIMIQ_PAY_IOS_URL = 'https://apps.apple.com/app/nimiq-pay/id6471844738'
export const NIMIQ_PAY_ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.nimiq.pay'
export const NIMIQ_PAY_LANDING_URL = 'https://nimiq.com/nimiq-pay/'

/** Synchronous best-effort check: is the Nimiq Pay host context present? */
export function isNimiqEnvironment(): boolean {
  return typeof window !== 'undefined' && !!window.nimiqPay
}

/**
 * Robust async detection. `window.nimiqPay` is the fast path, but during
 * provider injection it can briefly be absent, so we fall back to awaiting the
 * SDK `init()` with a short timeout before deciding we are NOT in Nimiq Pay.
 */
export async function detectNimiqPay(timeoutMs = 1500): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (window.nimiqPay) return true
  try {
    const ready = init({ timeout: timeoutMs })
    const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), timeoutMs + 200))
    const result = await Promise.race([ready.then(() => true), timeout])
    return result === true
  } catch {
    return false
  }
}

/** Detect a mobile device (used to choose deep link vs QR code). */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
}

/** Build the deep link that opens a given URL as a Mini App inside Nimiq Pay. */
export function buildNimiqPayDeepLink(targetUrl: string): string {
  return `nimiqpay://miniapp?url=${encodeURIComponent(targetUrl)}`
}

/** Absolute URL of a creator wall, safe to call on the client. */
export function wallUrl(handle: string): string {
  const origin =
    (typeof window !== 'undefined' && window.location?.origin) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  return `${origin}/${handle}`
}
