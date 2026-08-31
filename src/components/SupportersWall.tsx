'use client'
import { useState } from 'react'
import { useTranslations } from '@/lib/i18n'

// Deterministic avatar from the address: same supporter always gets the same
// emoji + colour. Reads as an identity, unlike a "27"/"UK" hex fragment.
const AVATARS = ['🦊', '🐼', '🦉', '🐢', '🦄', '🐙', '🦋', '🐝', '🦁', '🐺', '🦈', '🦩', '🐘', '🦜', '🐳', '🦖']

function avatarIndex(address: string, mod: number): number {
  let hash = 0
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0
  }
  return hash % mod
}

// Podium medals for the three biggest supporters - makes the ranking legible at
// a glance, not just implied by list order. Index 0/1/2 → gold/silver/bronze.
const RANK_MEDALS = ['🥇', '🥈', '🥉']

const colors = [
  'from-blue-400 to-blue-600',
  'from-purple-400 to-purple-600',
  'from-pink-400 to-pink-600',
  'from-amber-400 to-amber-600',
  'from-green-400 to-green-600',
  'from-cyan-400 to-cyan-600',
]

function AvatarChip({ s, idx, size = 'w-12 h-12 text-xl' }: { s: { address: string; totalNIM: number; tipCount: number; name?: string; streakWeeks?: number }; idx: number; size?: string }) {
  const emoji = AVATARS[avatarIndex(s.address, AVATARS.length)]
  const color = colors[avatarIndex(s.address, colors.length)]
  const medal = idx < 3 ? RANK_MEDALS[idx] : null
  return (
    <div className="relative">
      <div
        title={`${s.name || `${s.address.slice(0, 6)}…${s.address.slice(-4)}`} · ${s.totalNIM} NIM`}
        className={`${size} rounded-full flex items-center justify-center flex-shrink-0 shadow-md border-2 border-white/20 bg-gradient-to-br ${color}`}
      >
        {emoji}
      </div>
      {medal && (
        <div
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-xs"
          aria-label={`Rank ${idx + 1}`}
        >
          {medal}
        </div>
      )}
      {(s.streakWeeks ?? 0) >= 2 && (
        <div
          className="absolute -bottom-1.5 -right-1 rounded-full bg-[#fffdf7] border border-[#171614]/40 px-1 text-[10px] font-bold text-[#171614]"
          title={`${s.streakWeeks} weeks in a row`}
          aria-label={`${s.streakWeeks} week streak`}
        >
          🔥{s.streakWeeks}
        </div>
      )}
    </div>
  )
}

export default function SupportersWall({ supporters, collapsible = false }: { supporters: { address: string; totalNIM: number; tipCount: number; name?: string; streakWeeks?: number }[]; collapsible?: boolean }) {
  const t = useTranslations()
  // Collapsed by default on the public wall: the count row keeps the first
  // scroll light, the full grid is one tap away.
  const [open, setOpen] = useState(!collapsible)

  const fullName = (s: { name?: string; address: string }) => s.name || `${s.address.slice(0, 6)}…${s.address.slice(-4)}`

  // Compact summary row shown while collapsed.
  if (collapsible && supporters.length > 0 && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="surface w-full rounded-2xl px-5 py-4 shadow-lg text-left transition-all hover:shadow-xl hover:border-amber-400/30 animate-slide-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        style={{animationDelay: '0.4s'}}
      >
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2" suppressHydrationWarning>
            {supporters.slice(0, 4).map((s, idx) => (
              <div key={s.address} className="rounded-full ring-2 ring-slate-800"><AvatarChip s={s} idx={idx} size="w-9 h-9 text-base" /></div>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">
              {t('supporters')} ({supporters.length})
            </p>
            {supporters[0] && (
              <p className="text-xs text-slate-400 truncate">
                🏆 {fullName(supporters[0])} · {t(supporters[0].tipCount === 1 ? 'nimAcrossTip' : 'nimAcrossTips', { n: supporters[0].totalNIM, k: supporters[0].tipCount })}
              </p>
            )}
          </div>
          <span className="shrink-0 text-xs font-bold text-amber-300">{t('viewAll')} →</span>
        </div>
      </button>
    )
  }

  return (
    <div className="surface rounded-2xl p-6 shadow-lg animate-slide-up" style={{animationDelay: '0.4s'}}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm font-semibold text-slate-400 uppercase tracking-wide">{t('supporters')} ({supporters.length})</p>
        {collapsible && supporters.length > 0 && (
          <button
            onClick={() => setOpen(false)}
            aria-expanded={true}
            className="text-xs font-bold text-slate-400 hover:text-amber-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded px-1"
          >
            {t('showLess')} ↑
          </button>
        )}
      </div>

      {!supporters.length && (
        <div className="text-center py-8 text-slate-400">
          <p className="text-3xl mb-2">🤝</p>
          <p className="text-sm font-semibold">{t('beFirstSupporter')}</p>
          <p className="text-xs mt-1">{t('supportHelps')}</p>
        </div>
      )}

      {supporters.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-5" suppressHydrationWarning>
          {supporters.slice(0, 12).map((s, idx) => <AvatarChip key={s.address} s={s} idx={idx} />)}
          {supporters.length > 12 && (
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold bg-white/10 text-slate-300 flex-shrink-0 border-2 border-white/20">
              +{supporters.length - 12}
            </div>
          )}
        </div>
      )}

      {supporters[0] && (
        <div className="rounded-xl p-4 flex items-start gap-3 bg-amber-400/10 border border-amber-400/25 transition-all cursor-pointer">
          <span className="text-3xl animate-bounce-custom">🏆</span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-200 uppercase tracking-wide">{t('topSupporter')}</p>
            <p className="text-sm font-semibold text-white mt-1 truncate">
              {fullName(supporters[0])}
            </p>
            <p className="text-xs text-amber-200/70 mt-0.5">
              {t(supporters[0].tipCount === 1 ? 'nimAcrossTip' : 'nimAcrossTips', { n: supporters[0].totalNIM, k: supporters[0].tipCount })}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
