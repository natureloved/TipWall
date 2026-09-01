import type { Tip, TipReason } from './types'

export type FeedItem = {
  id: string
  handle: string
  amountNIM: number
  reason?: TipReason
  message?: string
  from: string
  timestamp: number
}

/**
 * Merge every wall's tips into one public activity feed. Only verified tips
 * leave the server, and only fields already visible on the wall page itself:
 * no sender address, no tx hash. Anonymous tips get an empty "from".
 */
export function buildRecentFeed(
  perWall: { handle: string; tips: Tip[] }[],
  limit = 8,
): FeedItem[] {
  const items: FeedItem[] = []
  for (const { handle, tips } of perWall) {
    for (const tip of tips) {
      if (!tip.verified) continue
      items.push({
        id: tip.id,
        handle,
        amountNIM: tip.amountNIM,
        reason: tip.reason,
        message: tip.message?.trim() || undefined,
        from: tip.anonymous ? '' : tip.senderName?.trim() || '',
        timestamp: tip.timestamp,
      })
    }
  }
  items.sort((a, b) => b.timestamp - a.timestamp)
  return items.slice(0, limit)
}
