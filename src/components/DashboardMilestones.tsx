import { DashboardData } from '@/lib/types'

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function DashboardMilestones({ data }: { data: DashboardData }) {
  if (!data.milestonesUnlocked?.length) return null

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Milestones unlocked</p>
      <div className="space-y-2">
        {data.milestonesUnlocked.slice().reverse().map((m, i) => (
          <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            <span className="text-lg">🎉</span>
            <div>
              <p className="text-sm font-medium text-[#1F2348]">{m.threshold.toLocaleString()} NIM</p>
              <p className="text-xs text-gray-400">
                Unlocked by {truncate(m.unlockedBy)} · {new Date(m.timestamp).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}