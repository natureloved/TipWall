'use client'
import { type ClaimIntent } from '@/lib/types'
import { timeAgo } from '@/lib/time'

export default function DashboardPledges({ pledges }: { pledges: ClaimIntent[] }) {
  const monthly = pledges.filter(p => p.recurrence === 'monthly')
  return (
    <section className="rounded-2xl border-2 border-[#171614] bg-[#fffaf0] p-4 shadow-[5px_5px_0_#171614] sm:p-6">
      <h2 className="font-serif text-lg font-semibold text-[#171614]">Monthly pledges</h2>
      <p className="mt-1 text-xs text-[#746b5e]">Supporters who asked to repeat their tip every month. Nimiq has no auto-charge - these are commitments, not subscriptions.</p>
      {!monthly.length && <p className="mt-4 text-sm text-[#746b5e]">No pledges yet.</p>}
      {!!monthly.length && (
        <ul className="mt-4 space-y-2">
          {monthly.map(p => (
            <li key={p.token} className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-[#171614]/25 bg-[#fffdf7] px-3 py-2">
              <span className="text-sm font-semibold text-[#171614]">
                {p.amountNIM} NIM / month
                {p.email && <span className="ml-2 text-xs font-medium text-[#746b5e]">{p.email}</span>}
              </span>
              <span className="text-xs text-[#746b5e]">
                {p.claimed ? '✓ fulfilled' : 'open'} · {timeAgo(p.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
