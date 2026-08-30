'use client'
import { useState } from 'react'
import { connectWallet, signProfileAuth } from '@/lib/nimiq'
import { normalizeAddress } from '@/lib/profile-auth'
import { useTranslations } from '@/lib/i18n'
import type { FunnelEvent } from '@/lib/events'
import { TIP_REASON_LABELS, type TipReason } from '@/lib/types'

type StatsResponse = {
  stats: Record<FunnelEvent, number>
  topRefs?: { ref: string; count: number }[]
  derived: {
    completedTips: number
    conversionRate: number
    recoveredSupporters: number
    lostSupporters: number
    reasonStats: { reason: TipReason; tips: number; nim: number }[]
    topReason: TipReason | null
  }
}

export default function AnalyticsClient({ handle, ownerAddress }: { handle: string; ownerAddress: string }) {
  const t = useTranslations()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<StatsResponse | null>(null)

  const loadAnalytics = async () => {
    setError(null)
    setLoading(true)
    try {
      const wallet = await connectWallet()
      if (normalizeAddress(wallet) !== normalizeAddress(ownerAddress)) {
        throw new Error('This wallet does not own @' + handle + '.')
      }
      // Signature-gated: prove ownership before reading the funnel.
      const auth = await signProfileAuth({ action: 'view', handle, walletAddress: wallet })
      const res = await fetch(`/api/stats/${handle}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load analytics')
      setData(json)
    } catch (err) {
      const error = err as Error
      setError(error.message || 'Could not load analytics')
    } finally {
      setLoading(false)
    }
  }

  const s = data?.stats
  const d = data?.derived

  const funnel: { label: string; value: number }[] = s
    ? [
        { label: t('funnelShares'), value: s.WALL_SHARED ?? 0 },
        { label: t('funnelVisits'), value: s.TIP_WALL_VIEWED },
        { label: t('funnelAttempts'), value: s.TIP_BUTTON_CLICKED },
        { label: t('funnelInstalls'), value: s.INSTALL_PROMPT_SHOWN },
        { label: t('funnelClaims'), value: s.CLAIM_LINK_CREATED },
        { label: t('funnelReturned'), value: s.RETURNED_AFTER_INSTALL },
        { label: t('funnelCompleted'), value: s.TIP_COMPLETED },
      ]
    : []

  const maxVal = funnel.reduce((m, f) => Math.max(m, f.value), 0) || 1

  return (
    <div className="min-h-screen bg-[#f4f0e6] p-4 text-[#171614] sm:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold text-[#171614]">@{handle} {t('analTitle')}</h1>
          <a href={`/${handle}`} className="rounded text-xs font-semibold text-[#b9382a] underline underline-offset-4 transition-colors hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c]">{t('analViewWall')}</a>
        </div>

        {!data && (
          <div className="rounded-2xl border-2 border-[#171614] bg-[#fffaf0] p-6 text-center shadow-[5px_5px_0_#171614]">
            <p className="mb-4 text-sm leading-relaxed text-[#5f574b]">
              {t('analUnlockBody')}
            </p>
            <button
              onClick={loadAnalytics}
              disabled={loading}
              className="min-h-11 rounded-xl bg-[#171614] px-5 py-2.5 text-sm font-bold text-[#fffdf7] shadow-[3px_3px_0_#f05a3c] transition-all hover:-translate-y-0.5 hover:bg-[#b9382a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-[#171614]"
            >
              {loading ? t('editSaving') : t('analUnlock')}
            </button>
            {error && <p className="mt-4 rounded-xl border border-[#d36b61] bg-[#fff0ed] p-3 text-sm font-medium text-[#8f2923]" role="alert">{error}</p>}
          </div>
        )}

        {data && d && (
          <div className="space-y-6">
            {/* Headline cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card label={t('analConversion')} value={`${d.conversionRate}%`} accent />
              <Card label={t('analRecovered')} value={d.recoveredSupporters} />
              <Card label={t('analLostSupporters')} value={d.lostSupporters} />
            </div>

            <div className="rounded-2xl border border-[#cfc2af] bg-[#fffaf0] p-5 shadow-[4px_4px_0_rgba(23,22,20,0.16)] sm:p-6">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[#b9382a]">{t('analAudience')}</h2>
              <p className="mb-4 text-xs leading-relaxed text-[#5f574b]">{t('analAudienceBody')}</p>
              {d.reasonStats.length === 0 ? <p className="text-sm text-[#746b5e]">{t('analReasonPending')}</p> : (
                <div className="space-y-3">
                  {d.reasonStats.map((item, index) => {
                    const label = TIP_REASON_LABELS[item.reason].label
                    const max = d.reasonStats[0].tips || 1
                    return <div key={item.reason}>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm"><span className="font-medium text-[#171614]">{TIP_REASON_LABELS[item.reason].emoji} {label}</span><span className="text-[#5f574b]">{item.tips} tips, {item.nim} NIM</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#e0d6c7]"><div className={`h-full rounded-full ${index === 0 ? 'bg-[#f05a3c]' : 'bg-[#5c99a9]'}`} style={{ width: `${(item.tips / max) * 100}%` }} /></div>
                    </div>
                  })}
                </div>
              )}
            </div>

            {/* Funnel */}
            <div className="rounded-2xl border border-[#cfc2af] bg-[#fffaf0] p-5 shadow-[4px_4px_0_rgba(23,22,20,0.16)] sm:p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#b9382a]">{t('analFunnel')}</h2>
              <div className="space-y-3">
                {funnel.map((f) => (
                  <div key={f.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#5f574b]">{f.label}</span>
                      <span className="font-semibold text-[#171614]">{f.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#e0d6c7]">
                      <div className="h-full rounded-full bg-[#f05a3c]" style={{ width: `${(f.value / maxVal) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Referrers */}
            <div className="rounded-2xl border border-[#cfc2af] bg-[#fffaf0] p-5 shadow-[4px_4px_0_rgba(23,22,20,0.16)] sm:p-6">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[#b9382a]">{t('analRefs')}</h2>
              {(!data.topRefs || data.topRefs.length === 0) ? (
                <p className="mt-2 text-sm text-[#746b5e]">{t('analRefsEmpty')}</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {data.topRefs.map(r => {
                    const max = data.topRefs![0].count || 1
                    return (
                      <div key={r.ref} className="flex items-center gap-3 text-sm">
                        <span className="w-24 truncate font-semibold text-[#171614]">{r.ref}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#e0d6c7]">
                          <div className="h-full bg-[#f05a3c]" style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
                        </div>
                        <span className="w-10 text-right font-bold text-[#5f574b]">{r.count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Lost vs Recovered */}
            <div className="rounded-2xl border border-[#cfc2af] bg-[#fffaf0] p-5 shadow-[4px_4px_0_rgba(23,22,20,0.16)] sm:p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#b9382a]">{t('analLost')}</h2>
              <div className="flex h-4 overflow-hidden rounded-full bg-[#e0d6c7]">
                <div className="h-full bg-[#3f6f4d]" style={{ width: `${pct(d.recoveredSupporters, d.recoveredSupporters + d.lostSupporters)}%` }} />
                <div className="h-full bg-[#b9473f]" style={{ width: `${pct(d.lostSupporters, d.recoveredSupporters + d.lostSupporters)}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs font-semibold">
                <span className="text-[#315c3e]">● Recovered: {d.recoveredSupporters}</span>
                <span className="text-[#8f2923]">● Lost: {d.lostSupporters}</span>
              </div>
            </div>

            <button onClick={loadAnalytics} disabled={loading} className="min-h-10 rounded px-2 text-xs font-semibold text-[#b9382a] underline underline-offset-4 transition-colors hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

function Card({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#cfc2af] bg-[#fffaf0] p-5 shadow-[4px_4px_0_rgba(23,22,20,0.16)]">
      <div className={`text-3xl font-bold ${accent ? 'text-[#b9382a]' : 'text-[#171614]'}`}>{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#5f574b]">{label}</div>
    </div>
  )
}
