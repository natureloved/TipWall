'use client'
import { Tip, TIP_REASON_LABELS, TipReason } from '@/lib/types'
import FiatHint from '@/components/FiatHint'
import { useTranslations } from '@/lib/i18n'
import { timeAgo } from '@/lib/time'

export default function TipFeed({ tips }: { tips: Tip[] }) {
  const t = useTranslations()
  return (
    <div className="tip-note-board surface rounded-2xl p-6 shadow-lg animate-slide-up" style={{animationDelay: '0.4s'}} suppressHydrationWarning>
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-1">Wall of appreciation</h2>
      <p className="text-xs text-slate-500 mb-4">Messages and reasons from the people your work helped.</p>
      {!tips.length && (
        <div className="text-center py-12 text-slate-400 animate-pulse">
          <p className="text-lg">✨</p>
          <p className="text-sm font-semibold mt-2">{t('noTipsYet')}</p>
        </div>
      )}
      <div className="tip-note-grid">
        {tips.map((tip) => {
          const reason = tip.reason ? TIP_REASON_LABELS[tip.reason as TipReason] : null
          const reasonLabel = tip.reason ? t(`reason_${tip.reason}`) : ''
          const shortAddress = tip.senderAddress
            ? `${tip.senderAddress.slice(0, 6)}…${tip.senderAddress.slice(-4)}`
            : ''
          const displayName = tip.anonymous ? '' : tip.senderName || shortAddress
          return (
            <article key={tip.id} className="tip-note-card">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate" title={tip.anonymous || !tip.senderAddress ? undefined : tip.senderAddress}>
                    {tip.anonymous ? '🕵️ Anonymous' : displayName}
                  </div>
                  {reason && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-white/10 hover:bg-white/15 rounded-full px-3 py-1 transition-colors">
                      {reason.emoji}
                      <span>{reasonLabel}</span>
                    </div>
                  )}
                  {tip.message && <p className="mt-2 text-sm text-slate-300 line-clamp-2 leading-relaxed">{tip.message}</p>}
                  {tip.reply && (
                    <div className="tip-reply-note mt-2 rounded-md px-2.5 py-1.5 text-xs leading-relaxed">
                      <span className="font-bold">↳ @{tip.handle}</span> {tip.reply.message}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold bg-gradient-to-r from-amber-300 to-amber-400 bg-clip-text text-transparent whitespace-nowrap">
                    {tip.amountNIM} NIM
                  </div>
                  <FiatHint nim={tip.amountNIM} className="block text-xs text-slate-500" />
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
            </article>
          )
        })}
      </div>
    </div>
  )
}
