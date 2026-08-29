import { Supporter } from '@/lib/types'

function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function DashboardSupporters({ supporters }: { supporters: Supporter[] }) {
  if (!supporters.length) return (
    <section aria-labelledby="dashboard-supporters-heading">
      <h2 id="dashboard-supporters-heading" className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5f574b]">
        Supporters
      </h2>
      <p className="rounded-lg border border-dashed border-[#171614]/30 bg-[#fffaf0] p-4 text-sm font-medium leading-relaxed text-[#5f574b]">
        No supporters yet. Share your wall to get your first tip.
      </p>
    </section>
  )

  return (
    <section aria-labelledby="dashboard-supporters-heading">
      <h2 id="dashboard-supporters-heading" className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5f574b]">
        All supporters ({supporters.length})
      </h2>
      <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {supporters.map((supporter) => (
          <li key={supporter.address} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#171614]/20 bg-[#fffaf0] px-3 py-2.5 text-sm">
            <span className="min-w-0 truncate font-mono text-xs font-medium text-[#5f574b]" title={supporter.address}>
              {truncate(supporter.address)}
            </span>
            <span className="text-right font-bold text-[#171614]">
              <span className="block">{supporter.totalNIM.toLocaleString()} NIM</span>
              <span className="block text-[0.68rem] font-medium text-[#746b5e]">
                {supporter.tipCount.toLocaleString()} {supporter.tipCount === 1 ? 'tip' : 'tips'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
