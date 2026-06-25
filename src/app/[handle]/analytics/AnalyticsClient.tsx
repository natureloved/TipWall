'use client'
import { useState } from 'react'
import { connectWallet, signProfileAuth } from '@/lib/nimiq'
import { normalizeAddress } from '@/lib/profile-auth'
import type { FunnelEvent } from '@/lib/events'

type StatsResponse = {
  stats: Record<FunnelEvent, number>
  derived: {
    completedTips: number
    conversionRate: number
    recoveredSupporters: number
    lostSupporters: number
  }
}

export default function AnalyticsClient({ handle, ownerAddress }: { handle: string; ownerAddress: string }) {
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
        { label: 'Wall visits', value: s.TIP_WALL_VIEWED },
        { label: 'Tip attempts', value: s.TIP_BUTTON_CLICKED },
        { label: 'Install prompt views', value: s.INSTALL_PROMPT_SHOWN },
        { label: 'Claim links created', value: s.CLAIM_LINK_CREATED },
        { label: 'Returned after install', value: s.RETURNED_AFTER_INSTALL },
        { label: 'Completed tips', value: s.TIP_COMPLETED },
      ]
    : []

  const maxVal = funnel.reduce((m, f) => Math.max(m, f.value), 0) || 1

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">@{handle} Analytics</h1>
          <a href={`/${handle}`} className="text-xs text-slate-400 hover:text-white underline">View wall</a>
        </div>

        {!data && (
          <div className="rounded-2xl bg-slate-800 p-6 text-center">
            <p className="text-sm text-slate-300 mb-4">
              Connect your owner wallet and sign to view your private conversion analytics.
            </p>
            <button
              onClick={loadAnalytics}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-bold text-sm disabled:opacity-60"
            >
              {loading ? 'Sign in wallet…' : 'Unlock analytics'}
            </button>
            {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
          </div>
        )}

        {data && d && (
          <div className="space-y-6">
            {/* Headline cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card label="Conversion rate" value={`${d.conversionRate}%`} accent />
              <Card label="Recovered supporters" value={d.recoveredSupporters} />
              <Card label="Lost supporters" value={d.lostSupporters} />
            </div>

            {/* Funnel */}
            <div className="rounded-2xl bg-slate-800 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">Conversion funnel</h2>
              <div className="space-y-3">
                {funnel.map((f) => (
                  <div key={f.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">{f.label}</span>
                      <span className="font-semibold">{f.value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" style={{ width: `${(f.value / maxVal) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lost vs Recovered */}
            <div className="rounded-2xl bg-slate-800 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">Lost vs Recovered Supporters</h2>
              <div className="flex h-4 rounded-full overflow-hidden bg-slate-700">
                <div className="bg-emerald-500 h-full" style={{ width: `${pct(d.recoveredSupporters, d.recoveredSupporters + d.lostSupporters)}%` }} />
                <div className="bg-red-500/70 h-full" style={{ width: `${pct(d.lostSupporters, d.recoveredSupporters + d.lostSupporters)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-2">
                <span className="text-emerald-400">● Recovered: {d.recoveredSupporters}</span>
                <span className="text-red-400">● Lost: {d.lostSupporters}</span>
              </div>
            </div>

            <button onClick={loadAnalytics} disabled={loading} className="text-xs text-slate-400 hover:text-white underline">
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
    <div className="rounded-2xl bg-slate-800 p-5">
      <div className={`text-3xl font-bold ${accent ? 'bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent' : 'text-white'}`}>{value}</div>
      <div className="text-xs text-slate-400 uppercase tracking-wide mt-1">{label}</div>
    </div>
  )
}
