// Preserve a user's tipping intent across an onboarding detour so we can resume
// it when they come back in the same browser. Cross-device / cross-context
// recovery is handled separately by the claim-link system (Phase 2).

const STORAGE_KEY = 'tipwall:pendingTipIntent'

export interface PendingTipIntent {
  creatorHandle: string
  amountNIM: number
  message?: string
  reason?: string
  createdAt: number
}

/** How long a stored intent stays valid before we consider it stale (24h). */
const INTENT_TTL_MS = 24 * 60 * 60 * 1000

export function savePendingTipIntent(intent: PendingTipIntent): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(intent))
  } catch {
    /* storage may be unavailable (private mode); fail silently */
  }
}

export function loadPendingTipIntent(): PendingTipIntent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const intent = JSON.parse(raw) as PendingTipIntent
    if (!intent?.creatorHandle || !Number.isFinite(intent.amountNIM)) return null
    if (Date.now() - intent.createdAt > INTENT_TTL_MS) {
      clearPendingTipIntent()
      return null
    }
    return intent
  } catch {
    return null
  }
}

export function clearPendingTipIntent(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
