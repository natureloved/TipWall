import { Supporter } from '@/lib/types'

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function DashboardSupporters({ supporters }: { supporters: Supporter[] }) {
  if (!supporters.length) return (
    <p className="text-sm text-gray-400">No supporters yet — share your wall to get your first tip.</p>
  )

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        All supporters ({supporters.length})
      </p>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {supporters.map((s) => (
          <div key={s.address} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm">
            <span className="text-gray-600 font-mono text-xs">{truncate(s.address)}</span>
            <span className="text-gray-800 font-medium">{s.totalNIM} NIM · {s.tipCount}x</span>
          </div>
        ))}
      </div>
    </div>
  )
}