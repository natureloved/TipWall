export type TipReason =
  | 'helpful_content'
  | 'open_source'
  | 'tutorial'
  | 'great_idea'
  | 'just_support'

export const TIP_REASON_LABELS: Record<TipReason, { emoji: string; label: string }> = {
  helpful_content: { emoji: '💡', label: 'Helpful content' },
  open_source: { emoji: '🔨', label: 'Open source contribution' },
  tutorial: { emoji: '📚', label: 'Tutorial / Education' },
  great_idea: { emoji: '⚡', label: 'Great idea' },
  just_support: { emoji: '❤️', label: 'Just support' },
}

export type OGMetadata = {
  title?: string
  description?: string
  image?: string
  url?: string
  siteName?: string
  stars?: number
  author?: string
}

export const MILESTONES = [100, 500, 1000, 5000, 10000]

export type MilestoneEvent = {
  threshold: number
  unlockedBy: string
  timestamp: number
}

export interface CreatorProfile {
  handle: string
  displayName: string
  bio: string
  contentUrl: string
  walletAddress: string
  ogCache?: OGMetadata
  ogCachedAt?: number
  achievement?: string
  goal?: {
    label: string
    targetNIM: number
  }
  milestones?: MilestoneEvent[]
  createdAt: number
}

export interface Tip {
  id: string
  handle: string
  senderAddress: string
  reason?: TipReason
  message?: string
  amountNIM: number
  txHash: string
  verified: boolean
  anonymous: boolean
  timestamp: number
}

export interface Supporter {
  address: string
  totalNIM: number
  tipCount: number
  firstTipAt: number
}
