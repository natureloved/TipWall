import type { CreatorProfile, MilestoneEvent, Supporter, Tip } from './types'

/** The portable, signed representation of a public TipWall history. */
export const WALL_SNAPSHOT_FORMAT = 'tipwall-wall-snapshot' as const
export const WALL_SNAPSHOT_VERSION = 1 as const

export type PortableProfile = Omit<CreatorProfile, 'notifyTelegram' | 'recoveryWalletAddress'>

export interface WallSnapshotPayload {
  format: typeof WALL_SNAPSHOT_FORMAT
  version: typeof WALL_SNAPSHOT_VERSION
  generatedAt: string
  profile: PortableProfile
  tips: Tip[]
  supporters: Supporter[]
  milestones: MilestoneEvent[]
  totals: {
    totalNIM: number
    totalTips: number
  }
}

export interface WallSnapshotSignature {
  scheme: 'nimiq-signed-message-v1'
  publicKey: string
  signature: string
}

export type SignedWallSnapshot = WallSnapshotPayload & {
  signature: WallSnapshotSignature
}

/**
 * Serialize JSON with object keys sorted recursively. Arrays retain their
 * supplied order because tip order is meaningful to a wall's history.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** Build the exact text that the Nimiq wallet signs for a snapshot. */
export function buildWallSnapshotMessage(payload: WallSnapshotPayload): string {
  return `TipWall wall snapshot v${WALL_SNAPSHOT_VERSION}\n${canonicalJson(payload)}`
}

/**
 * Remove owner-only profile fields and internal verification scheduling data.
 * Anonymous sender addresses are intentionally blank in the portable copy.
 * Hidden and unconfirmed rows are omitted because this format is a shareable public snapshot;
 * the authenticated dashboard and CSV remain the place for owner-only data.
 */
export function buildWallSnapshotPayload(input: {
  profile: CreatorProfile
  tips: Tip[]
  supporters?: Supporter[]
  milestones?: MilestoneEvent[]
  totalNIM: number
  totalTips: number
  generatedAt?: string
}): WallSnapshotPayload {
  const profile = Object.fromEntries(
    Object.entries(input.profile).filter(([key]) => key !== 'notifyTelegram' && key !== 'recoveryWalletAddress'),
  ) as PortableProfile
  const tips = input.tips
    .filter(tip => tip.verified && !tip.hiddenAt)
    .map(tip => {
      const portableTip = { ...tip }
      delete portableTip.verificationAttempts
      delete portableTip.nextVerificationAt
      if (portableTip.anonymous) {
        portableTip.senderAddress = ''
        delete portableTip.senderName
      }
      return portableTip
    })

  return {
    format: WALL_SNAPSHOT_FORMAT,
    version: WALL_SNAPSHOT_VERSION,
    generatedAt: input.generatedAt || new Date().toISOString(),
    profile,
    tips,
    supporters: input.supporters || [],
    milestones: input.milestones || [],
    totals: {
      totalNIM: Number(input.totalNIM) || 0,
      totalTips: Number(input.totalTips) || 0,
    },
  }
}

export function buildSignedWallSnapshot(
  payload: WallSnapshotPayload,
  signature: Omit<WallSnapshotSignature, 'scheme'>,
): SignedWallSnapshot {
  return {
    ...payload,
    signature: {
      scheme: 'nimiq-signed-message-v1',
      publicKey: signature.publicKey,
      signature: signature.signature,
    },
  }
}
