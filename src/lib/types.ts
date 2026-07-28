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

// Milestones are derived from a creator's goal rather than a fixed ladder, so the
// row always shows a meaningful mix of reached + aspirational rungs at any goal
// size. 100% lines up with the progress bar hitting full; 150% keeps a target
// visible above a smashed goal (see "goal smashed 🎉"). Rounded to tidy values so
// labels read "250 / 2.5k", never "247".
const MILESTONE_FRACTIONS = [0.25, 0.5, 0.75, 1, 1.5]

// Round to a step scaled by magnitude (nearest 10 under 1k, 50 under 5k, 100 under
// 50k, 500 above) so any goal — round or odd — yields clean milestone labels.
function roundNice(n: number): number {
  const step = n < 1000 ? 10 : n < 5000 ? 50 : n < 50000 ? 100 : 500
  return Math.max(step, Math.round(n / step) * step)
}

export function getGoalMilestones(targetNIM: number): number[] {
  const target = targetNIM > 0 ? targetNIM : 1000
  // De-dupe in case two fractions round to the same value on a very small goal.
  return [...new Set(MILESTONE_FRACTIONS.map(f => roundNice(target * f)))]
}

// Legacy fixed ladder — retained for any non-goal-aware callers.
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
  /**
   * Hex-encoded Ed25519 public key of the wallet that owns this profile,
   * captured at creation. Only a signature from this key (i.e. this wallet)
   * is allowed to edit the profile afterwards.
   */
  ownerPublicKey?: string
  ogCache?: OGMetadata
  ogCachedAt?: number
  achievement?: string
  goal?: {
    label: string
    targetNIM: number
  }
  milestones?: MilestoneEvent[]
  createdAt: number
  updatedAt?: number
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

/**
 * A non-custodial claim intent. Bridges external traffic into Nimiq Pay: the
 * tip details are reserved under a token so the user (or anyone they share the
 * link with) can complete the tip from any device, inside Nimiq Pay. NO funds
 * are ever held — this only preserves intent. A "pledge" is the same record
 * with source 'pledge' (and optionally an email, deferred for v1).
 */
export interface ClaimIntent {
  token: string
  creatorHandle: string
  amountNIM: number
  message?: string
  reason?: TipReason
  email?: string
  source: 'redirect' | 'pledge'
  claimed: boolean
  createdAt: number
  claimedAt?: number
  claimTxHash?: string
}

export type DashboardData = {
  profile: CreatorProfile
  tips: Tip[]
  supporters: Supporter[]
  totalNIM: number
  totalTips: number
  milestonesUnlocked: MilestoneEvent[]
  nextMilestone: number | null
  tipsLast7Days: { date: string; nim: number; count: number }[]
  topReason: TipReason | null
}
