export type TipReason =
  | 'helpful_content'
  | 'open_source'
  | 'tutorial'
  | 'great_idea'
  | 'just_support'

export type TipAsset = 'NIM' | 'USDT'

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
  /** Negative-cache marker: upstream fetch failed, fail fast for a while. */
  neg?: boolean
}

/** Curated wall palettes. 'paper' is the default editorial identity. */
export type WallTheme = 'paper' | 'mint' | 'blush' | 'sky' | 'sun'

/** Curated discovery categories - the explore filter axis (what the creator makes). */
export type CreatorCategory = 'art' | 'code' | 'education' | 'music' | 'video' | 'gaming' | 'freelance' | 'student' | 'community'

export const CREATOR_CATEGORIES: Record<CreatorCategory, { emoji: string; label: string }> = {
  art: { emoji: '🎨', label: 'Art & Design' },
  code: { emoji: '💻', label: 'Code & Open Source' },
  education: { emoji: '📚', label: 'Writing & Education' },
  music: { emoji: '🎵', label: 'Music & Audio' },
  video: { emoji: '🎬', label: 'Streaming & Video' },
  gaming: { emoji: '🎮', label: 'Gaming' },
  freelance: { emoji: '🧰', label: 'Freelance & Services' },
  student: { emoji: '🎓', label: 'Student Projects' },
  community: { emoji: '🌱', label: 'Community & Other' },
}

export type SocialLinks = {
  website?: string
  x?: string
  github?: string
  telegram?: string
  instagram?: string
  linkedin?: string
}

// Milestones are derived from a creator's goal rather than a fixed ladder, so the
// row always builds up to - and ends exactly at - the goal (the goal is the final
// rung, lining up with the progress bar hitting full). Even quarter-steps give a
// predictable shape at any goal size: 1000 -> [250, 500, 750, 1000];
// 10000 -> [2500, 5000, 7500, 10000]. Rounded to tidy values so labels read
// "250 / 2.5k", never "247".
const MILESTONE_FRACTIONS = [0.25, 0.5, 0.75, 1]

// Round to a step scaled by magnitude (nearest 10 under 1k, 50 under 5k, 100 under
// 50k, 500 above) so any goal - round or odd - yields clean milestone labels.
function roundNice(n: number): number {
  const step = n < 1000 ? 10 : n < 5000 ? 50 : n < 50000 ? 100 : 500
  return Math.max(step, Math.round(n / step) * step)
}

export function getGoalMilestones(targetNIM: number): number[] {
  const target = targetNIM > 0 ? Math.round(targetNIM) : 1000
  // The goal itself is always the final, exact rung. Lower rungs are rounded for
  // tidy labels; de-dupe in case two fractions round together on a tiny goal, and
  // drop any rounded rung that meets/exceeds the goal so nothing sits past it.
  const lower = MILESTONE_FRACTIONS.slice(0, -1)
    .map(f => roundNice(target * f))
    .filter(m => m < target)
  return [...new Set([...lower, target])]
}

// Legacy fixed ladder - retained for any non-goal-aware callers.
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
  /** Optional public avatar URL. */
  avatarUrl?: string
  /** Optional structured links shown on the public wall. */
  socialLinks?: SocialLinks
  walletAddress: string
  /** Optional Polygon address for receiving USDT (Polygon PoS). */
  usdtPolygonAddress?: string
  /**
   * Hex-encoded Ed25519 public key of the wallet that owns this profile,
   * captured at creation. Only a signature from this key (i.e. this wallet)
   * is allowed to edit the profile afterwards.
   */
  ownerPublicKey?: string
  /** Optional pre-authorized wallet that can recover/rotate ownership. */
  recoveryWalletAddress?: string
  ogCache?: OGMetadata
  ogCachedAt?: number
  achievement?: string
  /**
   * Owner-private Telegram bot webhook (https://api.telegram.org/bot…).
   * Stripped from every public profile read - see stripSensitiveProfileFields.
   */
  notifyTelegram?: string
  theme?: WallTheme
  /** Curated discovery category (explore filter axis). */
  category?: CreatorCategory
  /** Free-form self-described tags (max 3, ≤20 chars each). */
  tags?: string[]
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
  /** Self-reported display name (optional). Stripped for anonymous tips. */
  senderName?: string
  reason?: TipReason
  message?: string
  amountNIM: number
  /** Asset used for this tip. Legacy records are NIM when omitted. */
  asset?: TipAsset
  /** USDT amount when `asset` is `USDT`, represented in decimal units. */
  amountUSDT?: number
  txHash: string
  verified: boolean
  anonymous: boolean
  timestamp: number
  /** Number of bounded attempts made to resolve a pending payment. */
  verificationAttempts?: number
  /** Earliest time a pending payment may be checked again. */
  nextVerificationAt?: number
  /** Creator's thank-you reply, pinned to this tip. */
  reply?: { message: string; at: number }
  /** Set when the creator hides a tip from the public wall. */
  hiddenAt?: number
  /** Set when public supporter content was permanently removed by the owner. */
  deletedAt?: number
}

export interface Supporter {
  address: string
  totalNIM: number
  totalUSDT?: number
  tipCount: number
  firstTipAt: number
  /** Latest self-reported display name for this address, if any. */
  name?: string
  /** Consecutive ISO weeks with at least one verified tip (≥2 = streak). */
  streakWeeks?: number
}

/**
 * A non-custodial claim intent. Bridges external traffic into Nimiq Pay: the
 * tip details are reserved under a token so the user (or anyone they share the
 * link with) can complete the tip from any device, inside Nimiq Pay. NO funds
 * are ever held - this only preserves a one-time intent.
 */
export interface ClaimIntent {
  token: string
  creatorHandle: string
  amountNIM: number
  message?: string
  reason?: TipReason
  source: 'redirect'
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
