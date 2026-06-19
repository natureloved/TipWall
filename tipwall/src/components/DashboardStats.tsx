'use client'
import AnimatedNumber from './AnimatedNumber'

interface DashboardStatsProps {
  totalNIM: number
  totalTips: number
  supporterCount: number
}

export default function DashboardStats({ totalNIM, totalTips, supporterCount }: DashboardStatsProps) {
  const stats = [
    { value: <AnimatedNumber value={totalNIM} />, label: 'Total NIM', bg: 'from-amber-400 to-amber-600' },
    { value: <AnimatedNumber value={totalTips} />, label: 'Total Tips', bg: 'from-purple-400 to-purple-600' },
    { value: <AnimatedNumber value={supporterCount} />, label: 'Supporters', bg: 'from-green-400 to-green-600' },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {stats.map((stat, idx) => (
        <div key={stat.label} className="rounded-2xl bg-white p-6 shadow-lg border-2 border-amber-400/10 hover:shadow-xl transition-all animate-slide-up" style={{animationDelay: `${idx * 0.05}s`}}>
          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${stat.bg} mb-3`}>
            <span className="text-white text-lg">
              {idx === 0 ? '💰' : idx === 1 ? '💝' : '👥'}
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}