import { DashboardData } from '@/lib/types'

function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function DashboardMilestones({ data }: { data: DashboardData }) {
  if (!data.milestonesUnlocked?.length) return null

  return (
    <section aria-labelledby="dashboard-milestones-heading">
      <h2 id="dashboard-milestones-heading" className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5f574b]">
        Milestones unlocked
      </h2>
      <div className="space-y-2">
        {data.milestonesUnlocked.slice().reverse().map((milestone, index) => (
          <article key={index} className="flex items-start gap-3 rounded-lg border border-[#3f6f4d]/30 bg-[#eef5ed] p-3">
            <span className="mt-0.5 rounded-full border border-[#3f6f4d]/35 bg-[#fffaf0] px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-[#3f6f4d]">
              Goal
            </span>
            <div className="min-w-0">
              <p className="font-serif text-base font-semibold text-[#171614]">{milestone.threshold.toLocaleString()} NIM</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-[#5f574b]">
                <span>Unlocked by <span className="font-mono text-[#171614]">{truncate(milestone.unlockedBy)}</span></span>
                <span>{new Date(milestone.timestamp).toLocaleDateString()}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
