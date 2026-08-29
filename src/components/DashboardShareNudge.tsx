'use client'
import { DashboardData } from '@/lib/types'

/**
 * Turns the dashboard from a report into a prompt: when the wall is silent,
 * tell the creator the one thing that changes it - putting the link where
 * their audience is - and hand them the Share Kit.
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
      <div className="rounded-xl border border-[#171614]/25 bg-[#fff1b8] p-4 text-[#171614] shadow-[3px_3px_0_rgba(23,22,20,0.10)]">
        <p className="text-sm font-semibold text-[#8c2f25]">Your wall hasn&apos;t been discovered yet</p>
        <p className="mt-1 text-xs text-[#5f574b]">
          Walls don&apos;t get found on their own. They earn where your audience already is.
          Grab your link, QR code, and README badge and put them out there.
        </p>
        <a
          href={shareHref}
          className="mt-3 inline-block rounded-lg border border-[#171614] bg-[#f05a3c] px-4 py-2 text-xs font-bold text-[#171614] transition-colors hover:bg-[#ff7358] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171614] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff1b8]"
        >
          Open your Share Kit
        </a>
      </div>
    )
  }

  if (tipsThisWeek === 0) {
    return (
      <div className="rounded-xl border border-[#7d9b85] bg-[#e7f0e7] p-4">
        <p className="text-sm font-semibold text-[#315c3b]">Quiet week. No tips in the last 7 days</p>
        <p className="mt-1 text-xs text-[#425b49]">
          A reshare, a new video description, or a README badge usually wakes a wall up.
        </p>
        <a
          href={shareHref}
          className="mt-2 inline-block text-xs font-bold text-[#315c3b] underline underline-offset-4 transition-colors hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315c3b]"
        >
          Open your Share Kit
        </a>
      </div>
    )
  }

  return (
    <a
      href={shareHref}
      className="block rounded-xl border border-[#171614]/20 bg-[#fffdf7] p-3 text-xs font-medium text-[#5f574b] transition-colors hover:border-[#b9382a]/50 hover:bg-[#fff1eb] hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9382a] focus-visible:ring-offset-2"
    >
      📣 Share Kit: link, QR poster, README badge, embeds
    </a>
  )
}
