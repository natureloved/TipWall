'use client'
import { useCallback } from 'react'
import { Tip, TIP_REASON_LABELS } from '@/lib/types'

export default function TipFeed({ tips }: { tips: Tip[] }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Live Feed</h2>
      {!tips.length && <p className="text-sm text-gray-500 text-center py-6">No tips yet. Be the first!</p>}
      <div className="divide-y divide-slate-100">
        {tips.map((tip) => {
          const reason = tip.reason ? TIP_REASON_LABELS[tip.reason] : null
          return (
            <div key={tip.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{tip.senderAddress}</div>
                  {reason && <div className="mt-1 inline-flex items-center gap-1 text-xs text-gray-700 bg-slate-100 rounded-full px-2 py-0.5">{reason.emoji} {reason.label}</div>}
                  {tip.message && <p className="mt-1 text-sm text-gray-700 line-clamp-2">{tip.message}</p>}
                </div>
                <div className="text-yellow-700 font-semibold text-sm whitespace-nowrap">{tip.amountNIM} NIM</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
