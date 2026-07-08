'use client'
import { useEffect, useState } from 'react'
import { MILESTONES } from '@/lib/types'
import { milestoneShareText, shareIntentUrl } from '@/lib/share'
import { track } from '@/lib/analytics'

interface Props {
  previousTotal: number
  newTotal: number
  /** When set, the banner offers a one-tap share of the milestone. */
  handle?: string
  onDone?: () => void
}

/**
 * Confetti + banner when a total crosses a milestone. The crossed milestone is
 * derived from props (no state to sync); the parent remounts this component
 * (via key) per tip, so the auto-dismiss timer resets naturally.
 */
export default function MilestoneCelebration({ previousTotal, newTotal, handle, onDone }: Props) {
  const milestone = MILESTONES.find(m => previousTotal < m && newTotal >= m) ?? null
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!milestone) return

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

    // Milestones with a share offer stick around longer than a passive toast.
    const timer = setTimeout(() => {
      setDismissed(true)
      onDone?.()
    }, handle ? 9000 : 5000)
    return () => clearTimeout(timer)
  }, [milestone, handle, onDone])

  if (!milestone || dismissed) return null

  const shareMilestone = () => {
    if (!handle) return
    const url = `${window.location.origin}/${handle}`
    track(handle, 'WALL_SHARED')
    window.open(shareIntentUrl('x', milestoneShareText(handle, milestone), url), '_blank', 'noopener,noreferrer')
    setDismissed(true)
  }

  return (
    <div className="fixed inset-x-4 top-4 z-50 animate-in slide-in-from-top-2" role="status">
      <div className="bg-[#1F2348] text-white rounded-2xl p-4 shadow-2xl">
        <p className="text-2xl mb-1">🎉</p>
        <p className="font-medium text-[#F6B221]">
          {milestone.toLocaleString()} NIM Milestone Unlocked!
        </p>
        <p className="text-sm text-[#AFA9EC] mt-1">
          The creator just crossed {milestone.toLocaleString()} NIM in tips!
        </p>
        {handle && (
          <button
            type="button"
            onClick={shareMilestone}
            className="mt-3 px-4 py-2 rounded-lg bg-[#F6B221] hover:bg-amber-300 text-[#1F2348] text-xs font-bold transition-colors"
          >
            Share this milestone
          </button>
        )}
      </div>
    </div>
  )
}
