'use client'
import { DashboardData } from '@/lib/types'

/**
 * Turns the dashboard from a report into a prompt: when the wall is silent,
 * tell the creator the one thing that changes it — putting the link where
 * their audience is — and hand them the Share Kit.
 *
 * Nudge tiers:
 *  - no tips ever      → strongest push (the wall is invisible)
 *  - no tips in 7 days → gentle "reshare" reminder
 *  - otherwise         → compact Share Kit shortcut (sharing never stops mattering)
 */
export default function DashboardShareNudge({ data }: { data: DashboardData }) {
  const handle = data.profile.handle
  const shareHref = `/${handle}/share`
  const tipsThisWeek = data.tipsLast7Days.reduce((s, d) => s + d.count, 0)

  if (data.totalTips === 0) {
    return (
      <div className="bg-[#1F2348] rounded-xl p-4 text-white">
        <p className="text-sm font-semibold text-[#F6B221]">Your wall hasn&apos;t been discovered yet</p>
        <p className="text-xs text-[#AFA9EC] mt-1">
          Walls don&apos;t get found on their own — they earn where your audience already is.
          Grab your link, QR code, and README badge and put them out there.
        </p>
        <a
          href={shareHref}
          className="inline-block mt-3 px-4 py-2 rounded-lg bg-[#F6B221] hover:bg-amber-300 text-[#1F2348] text-xs font-bold transition-colors"
        >
          Open your Share Kit →
        </a>
      </div>
    )
  }

  if (tipsThisWeek === 0) {
    return (
      <div className="bg-[#FAEEDA] rounded-xl p-4">
        <p className="text-sm font-semibold text-[#633806]">Quiet week — no tips in the last 7 days</p>
        <p className="text-xs text-[#8a5a1a] mt-1">
          A reshare, a new video description, or a README badge usually wakes a wall up.
        </p>
        <a
          href={shareHref}
          className="inline-block mt-2 text-xs font-bold text-[#633806] underline underline-offset-4 hover:text-[#1F2348] transition-colors"
        >
          Open your Share Kit →
        </a>
      </div>
    )
  }

  return (
    <a
      href={shareHref}
      className="block bg-gray-50 hover:bg-gray-100 rounded-xl p-3 text-xs text-gray-500 transition-colors"
    >
      📣 Share Kit — link, QR poster, README badge, embeds →
    </a>
  )
}
