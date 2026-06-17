'use client'
import { Tip, TIP_REASON_LABELS, TipReason } from '@/lib/types'

export default function TipFeed({ tips }: { tips: Tip[] }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg border-2 border-amber-400/10 animate-slide-up" style={{animationDelay: '1.1s'}} suppressHydrationWarning>
      <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Live Feed</h2>
      {!tips.length && (
        <div className="text-center py-12 text-gray-400 animate-pulse">
          <p className="text-lg">✨</p>
          <p className="text-sm font-semibold mt-2">No tips yet. Be the first!</p>
        </div>
      )}
      <div className="space-y-3 divide-y divide-gray-100">
        {tips.map((tip, idx) => {
          const reason = tip.reason ? TIP_REASON_LABELS[tip.reason as TipReason] : null
          return (
            <div key={tip.id} className="py-3 first:pt-0 last:pb-0 hover:bg-gray-50 transition-colors duration-200 px-2 rounded-lg" style={{animationDelay: `${1.2 + idx * 0.05}s`}}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {tip.anonymous ? '🕵️ Anonymous' : tip.senderAddress}
                  </div>
                  {reason && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-150 rounded-full px-3 py-1 transition-colors">
                      {reason.emoji}
                      <span>{reason.label}</span>
                    </div>
                  )}
                  {tip.message && <p className="mt-2 text-sm text-gray-700 line-clamp-2 leading-relaxed">{tip.message}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent whitespace-nowrap">
                    {tip.amountNIM} NIM
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {tip.verified ? '✓ Verified' : 'Pending'}
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
