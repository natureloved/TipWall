export default function SupportersWall({ supporters }: { supporters: { address: string; totalNIM: number; tipCount: number }[] }) {
  if (!supporters.length) return null

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Supporters</p>
        <p className="text-xs text-gray-400">
          {supporters.length} {supporters.length === 1 ? 'person' : 'people'} funded this creator
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {supporters.slice(0, 12).map((s) => {
          const initials = s.address.slice(2, 4).toUpperCase()
          const colors = [
            ['#E1F5EE', '#085041'], ['#EEEDFE', '#3C3489'],
            ['#FBEAF0', '#72243E'], ['#FEF3E0', '#854F0B'],
            ['#E8F4FD', '#1A5276'], ['#F0FDF4', '#166534'],
          ]
          const [bg, color] = colors[s.address.charCodeAt(2) % colors.length]
          return (
            <div key={s.address} title={`${s.address.slice(0, 6)}…${s.address.slice(-4)} · ${s.totalNIM} NIM`} className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0" style={{ background: bg, color }}>
              {initials}
            </div>
          )
        })}
        {supporters.length > 12 && (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium bg-gray-100 text-gray-500 flex-shrink-0">
            +{supporters.length - 12}
          </div>
        )}
      </div>

      {supporters[0] && (
        <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: '#FAEEDA' }}>
          <span className="text-lg">🏆</span>
          <div>
            <p className="text-xs font-medium" style={{ color: '#854F0B' }}>Top supporter</p>
            <p className="text-sm" style={{ color: '#412402' }}>
              {supporters[0].address.slice(0, 6)}…{supporters[0].address.slice(-4)} · {supporters[0].totalNIM} NIM across {supporters[0].tipCount} tips
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
