import { MilestoneEvent, MILESTONES } from './types'

export function checkMilestone(
  previousTotal: number,
  newTotal: number,
  tipperAddress: string,
  milestones: number[] = MILESTONES,
): MilestoneEvent | null {
  const milestone = milestones.find(m => previousTotal < m && newTotal >= m)
  if (!milestone) return null
  return { threshold: milestone, unlockedBy: tipperAddress, timestamp: Date.now() }
}
