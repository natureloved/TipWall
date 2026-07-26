'use client'
import { Tip, TIP_REASON_LABELS, TipReason } from '@/lib/types'
import { useTranslations } from '@/lib/i18n'
import { timeAgo } from '@/lib/time'

export default function TipFeed({ tips }: { tips: Tip[] }) {
  const t = useTranslations()
  return (
    <div className="rounded-2xl bg-slate-800/60 backdrop-blur p-6 shadow-lg border-2 border-amber-400/10 animate-slide-up" style={{animationDelay: '0.4s'}} suppressHydrationWarning>
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">{t('liveFeed')}</h2>
      {!tips.length && (
        <div className="text-center py-12 text-slate-400 animate-pulse">
          <p className="text-lg">✨</p>
          <p className="text-sm font-semibold mt-2">{t('noTipsYet')}</p>
        </div>
      )}
      <div className="space-y-3 divide-y divide-white/10">
        {tips.map((tip) => {
          const reason = tip.reason ? TIP_REASON_LABELS[tip.reason as TipReason] : null
          const reasonLabel = tip.reason ? t(`reason_${tip.reason}`) : ''
          const shortAddress = tip.senderAddress
            ? `${tip.senderAddress.slice(0, 6)}…${tip.senderAddress.slice(-4)}`
            : ''
          return (
            <div key={tip.id} className="py-3 first:pt-0 last:pb-0 hover:bg-white/5 transition-colors duration-200 px-2 rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate font-mono" title={tip.anonymous ? undefined : tip.senderAddress}>
                    {tip.anonymous ? '🕵️ Anonymous' : shortAddress}
                  </div>
                  {reason && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-white/10 hover:bg-white/15 rounded-full px-3 py-1 transition-colors">
                      {reason.emoji}
                      <span>{reasonLabel}</span>
                    </div>
                  )}
                  {tip.message && <p className="mt-2 text-sm text-slate-300 line-clamp-2 leading-relaxed">{tip.message}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold bg-gradient-to-r from-amber-300 to-amber-400 bg-clip-text text-transparent whitespace-nowrap">
                    {tip.amountNIM} NIM
                  </div>
                  <div
                    className="text-xs text-slate-400 mt-1"
                    title={tip.verified ? undefined : t('confirmingOnChain')}
                  >
                    {tip.verified ? t('verified') : t('pending')}
                  </div>
                  <div className="text-xs text-slate-500 mt-1" suppressHydrationWarning>
                    {timeAgo(tip.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
