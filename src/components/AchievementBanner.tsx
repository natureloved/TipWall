'use client'

interface Props { achievement: string }

export default function AchievementBanner({ achievement }: Props) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#171614]/25 bg-[#fff1b8] px-4 py-3 text-[#171614] shadow-[3px_3px_0_rgba(23,22,20,0.10)]">
      <span className="text-lg" aria-hidden="true">🎯</span>
      <div>
        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-[#746b5e]">Currently working on</p>
        <p className="text-sm font-semibold text-[#171614]">{achievement}</p>
      </div>
    </div>
  )
}
