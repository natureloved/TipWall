'use client'
import { type Tip } from '@/lib/types'

function csvCell(value: string | number | boolean): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function DashboardExport({ handle, tips }: { handle: string; tips: Tip[] }) {
  const download = () => {
    const rows = [
      ['date', 'amount_nim', 'reason', 'message', 'verified', 'sender'],
      ...tips.map(t => [
        new Date(t.timestamp).toISOString(),
        t.amountNIM,
        t.reason || '',
        t.message || '',
        t.verified,
        t.anonymous ? 'anonymous' : t.senderAddress,
      ]),
    ]
    const csv = rows.map(r => r.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tipwall-${handle}-tips.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section className="rounded-2xl border-2 border-[#171614] bg-[#fffaf0] p-4 shadow-[5px_5px_0_#171614] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-[#171614]">Export your data</h2>
          <p className="mt-1 text-xs text-[#746b5e]">Your tips are yours: download them as CSV any time.</p>
        </div>
        <button
          onClick={download}
          disabled={!tips.length}
          className="rounded-lg border border-[#171614] bg-[#f05a3c] px-4 py-2 text-xs font-bold text-[#171614] shadow-[3px_3px_0_#171614] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          Download CSV
        </button>
      </div>
    </section>
  )
}
