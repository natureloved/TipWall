'use client'
import { useEffect, useState } from 'react'
import { MILESTONES } from '@/lib/types'
import { milestoneShareText, shareIntentUrl } from '@/lib/share'
import { track } from '@/lib/analytics'

interface Props {
  previousTotal: number
  newTotal: number
  /** Goal-relative milestone ladder for this creator; defaults to the fixed ladder. */
  milestones?: number[]
  /** When set, the banner offers a one-tap share of the milestone. */
  handle?: string
  onDone?: () => void
}

/**
 * Confetti + banner when a total crosses a milestone. The crossed milestone is
 * derived from props (no state to sync); the parent remounts this component
 * (via key) per tip, so the auto-dismiss timer resets naturally.
 */
export default function MilestoneCelebration({ previousTotal, newTotal, milestones = MILESTONES, handle, onDone }: Props) {
  const milestone = milestones.find(m => previousTotal < m && newTotal >= m) ?? null
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
        colors: ['#F6B221', '#F05A3C', '#3F6F4D', '#FFFDF7'],
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
      <div className="mx-auto max-w-md rounded-2xl border border-[#171614] bg-[#171614] p-4 text-[#fffdf7] shadow-[5px_5px_0_#f05a3c]">
        <p className="text-2xl mb-1">🎉</p>
        <p className="font-medium text-[#F6B221]">
          {milestone.toLocaleString()} NIM Milestone Unlocked!
        </p>
        <p className="mt-1 text-sm text-[#e9e2d2]">
          This wall just crossed {milestone.toLocaleString()} NIM in support!
        </p>
        {handle && (
          <button
            type="button"
            onClick={shareMilestone}
            className="mt-3 rounded-lg border border-[#fffdf7] bg-[#F6B221] px-4 py-2 text-xs font-bold text-[#171614] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#ffd05f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fffdf7]"
          >
            Share this milestone
          </button>
        )}
      </div>
    </div>
  )
}
