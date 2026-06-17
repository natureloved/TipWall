export default function SupportersWall({ supporters }: { supporters: { address: string; totalNIM: number; tipCount: number }[] }) {
  if (!supporters.length) return null

  const colors = [
    { bg: 'from-blue-400 to-blue-600', hex: '#4C6EF5' },
    { bg: 'from-purple-400 to-purple-600', hex: '#9C6EF5' },
    { bg: 'from-pink-400 to-pink-600', hex: '#F55DA5' },
    { bg: 'from-amber-400 to-amber-600', hex: '#F6B221' },
    { bg: 'from-green-400 to-green-600', hex: '#10B981' },
    { bg: 'from-cyan-400 to-cyan-600', hex: '#06B6D4' },
  ]

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg hover:shadow-xl transition-all border-2 border-amber-400/10 hover:border-amber-400/30 animate-slide-up" style={{animationDelay: '1s'}}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Supporters ({supporters.length})</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-5" suppressHydrationWarning>
        {supporters.slice(0, 12).map((s, idx) => {
          const initials = s.address.slice(2, 4).toUpperCase()
          const color = colors[idx % colors.length]
          return (
            <div
              key={s.address}
              title={`${s.address.slice(0, 6)}…${s.address.slice(-4)} · ${s.totalNIM} NIM`}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 cursor-pointer transition-all duration-300 transform hover:scale-125 hover:-translate-y-2 shadow-md hover:shadow-lg border-2 border-white bg-gradient-to-br ${color.bg} text-white`}
            >
              {initials}
            </div>
          )
        })}
        {supporters.length > 12 && (
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold bg-gray-100 text-gray-600 flex-shrink-0 border-2 border-gray-200">
            +{supporters.length - 12}
          </div>
        )}
      </div>

      {supporters[0] && (
        <div className="rounded-xl p-4 flex items-start gap-3 bg-gradient-to-br from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-150 transition-all cursor-pointer">
          <span className="text-3xl animate-bounce-custom">🏆</span>
          <div>
            <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">Top Supporter</p>
            <p className="text-sm font-semibold text-amber-950 mt-1">
              {supporters[0].address.slice(0, 6)}…{supporters[0].address.slice(-4)}
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              {supporters[0].totalNIM} NIM across {supporters[0].tipCount} tip{supporters[0].tipCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
