'use client'
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

// Podium medals for the three biggest supporters — makes the ranking legible at
// a glance, not just implied by list order. Index 0/1/2 → gold/silver/bronze.
const RANK_MEDALS = ['🥇', '🥈', '🥉']

export default function SupportersWall({ supporters }: { supporters: { address: string; totalNIM: number; tipCount: number }[] }) {
  const t = useTranslations()
  const colors = [
    'from-blue-400 to-blue-600',
    'from-purple-400 to-purple-600',
    'from-pink-400 to-pink-600',
    'from-amber-400 to-amber-600',
    'from-green-400 to-green-600',
    'from-cyan-400 to-cyan-600',
  ]

  return (
    <div className="rounded-2xl bg-slate-800/60 backdrop-blur p-6 shadow-lg hover:shadow-xl transition-all border-2 border-amber-400/10 hover:border-amber-400/30 animate-slide-up" style={{animationDelay: '0.4s'}}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-slate-400 uppercase tracking-wide">{t('supporters')} ({supporters.length})</p>
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
          {supporters.slice(0, 12).map((s, idx) => {
            const emoji = AVATARS[avatarIndex(s.address, AVATARS.length)]
            const color = colors[avatarIndex(s.address, colors.length)]
            const medal = idx < 3 ? RANK_MEDALS[idx] : null
            return (
              <div
                key={s.address}
                className="relative"
              >
                <div
                  title={`${s.address.slice(0, 6)}…${s.address.slice(-4)} · ${s.totalNIM} NIM`}
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0 shadow-md border-2 border-white/20 bg-gradient-to-br ${color}`}
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
              </div>
            )
          })}
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
          <div>
            <p className="text-xs font-bold text-amber-200 uppercase tracking-wide">{t('topSupporter')}</p>
            <p className="text-sm font-semibold text-white mt-1">
              {supporters[0].address.slice(0, 6)}…{supporters[0].address.slice(-4)}
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
