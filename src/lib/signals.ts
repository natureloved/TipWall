import { TIP_REASON_LABELS, type TipReason } from './types'

export type ReasonSignal = {
  reason: TipReason
  label: string
  emoji: string
  count: number
  total: number
  sharePct: number
}

/**
 * Turn a reason -> count map into the single strongest signal. The share is
 * computed against every verified tip (with or without a reason) so the
 * percentage never overstates the signal.
 */
export function topReasonSignal(
  reasonCounts: Record<string, number> | null | undefined,
  verifiedTipTotal: number,
): ReasonSignal | null {
  if (!reasonCounts || verifiedTipTotal <= 0) return null
  let best: { reason: TipReason; count: number } | null = null
  for (const [reason, count] of Object.entries(reasonCounts)) {
    if (!(reason in TIP_REASON_LABELS) || count <= 0) continue
    if (!best || count > best.count) best = { reason: reason as TipReason, count }
  }
  if (!best) return null
  const sharePct = Math.round((best.count / verifiedTipTotal) * 100)
  if (sharePct < 1) return null
  return {
    reason: best.reason,
    label: TIP_REASON_LABELS[best.reason].label,
    emoji: TIP_REASON_LABELS[best.reason].emoji,
    count: best.count,
    total: verifiedTipTotal,
    sharePct,
  }
}
