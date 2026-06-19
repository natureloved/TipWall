import { MilestoneEvent, MILESTONES } from './types'

export function checkMilestone(previousTotal: number, newTotal: number, tipperAddress: string): MilestoneEvent | null {
  const milestone = MILESTONES.find(m => previousTotal < m && newTotal >= m)
  if (!milestone) return null
  return { threshold: milestone, unlockedBy: tipperAddress, timestamp: Date.now() }
}
