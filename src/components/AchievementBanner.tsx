'use client'

interface Props { achievement: string }

export default function AchievementBanner({ achievement }: Props) {
  return (
    <div className="flex items-center gap-2 bg-gradient-to-r from-[#1F2348] to-[#2D3270] rounded-xl px-4 py-3 mb-4">
      <span className="text-lg">🎯</span>
      <div>
        <p className="text-[10px] text-[#AFA9EC] uppercase tracking-wide mb-0.5">Currently working on</p>
        <p className="text-sm text-white font-medium">{achievement}</p>
      </div>
    </div>
  )
}
