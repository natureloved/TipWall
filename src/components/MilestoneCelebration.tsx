'use client'
import { useEffect, useState } from 'react'
import { MILESTONES, MilestoneEvent } from '@/lib/types'

interface Props {
  previousTotal: number
  newTotal: number
  onUnlock?: (event: MilestoneEvent) => void
  onDone?: () => void
}

export default function MilestoneCelebration({ previousTotal, newTotal, onUnlock }: Props) {
  const [unlocked, setUnlocked] = useState<MilestoneEvent | null>(null)

  useEffect(() => {
    const milestone = MILESTONES.find(m => previousTotal < m && newTotal >= m)
    if (!milestone) return

    const event = { threshold: milestone, unlockedBy: '', timestamp: Date.now() }
    setUnlocked(event)
    onUnlock?.(event)

    // Dynamically load confetti to avoid SSR issues
    import('canvas-confetti').then((module) => {
      const confetti = module.default
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F6B221', '#EF9F27', '#1F2348', '#ffffff'],
      })
    }).catch(() => {})

    const timer = setTimeout(() => setUnlocked(null), 5000)
    return () => clearTimeout(timer)
  }, [previousTotal, newTotal, onUnlock])

  if (!unlocked) return null

  return (
    <div className="fixed inset-x-4 top-4 z-50 animate-in slide-in-from-top-2">
      <div className="bg-[#1F2348] text-white rounded-2xl p-4 shadow-2xl">
        <p className="text-2xl mb-1">🎉</p>
        <p className="font-medium text-[#F6B221]">
          {unlocked.threshold.toLocaleString()} NIM Milestone Unlocked!
        </p>
        <p className="text-sm text-[#AFA9EC] mt-1">
          The creator just crossed {unlocked.threshold.toLocaleString()} NIM in tips!
        </p>
      </div>
    </div>
  )
}
