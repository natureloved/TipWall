'use client'
import { useState, useEffect, useCallback } from 'react'
import { type Tip, type MilestoneEvent } from '@/lib/types'
import AchievementBanner from '@/components/AchievementBanner'
import ContentPreviewCard from '@/components/ContentPreviewCard'
import TipModal from '@/components/TipModal'
import MilestoneCelebration from '@/components/MilestoneCelebration'
import SupportersWall from '@/components/SupportersWall'
import TipFeed from '@/components/TipFeed'

export default function TipWallClient({ handle, initialProfile }: { handle: string; initialProfile: any }) {
  const [profile, setProfile] = useState(initialProfile)
  const [tips, setTips] = useState<Tip[]>([])
  const [totalNIM, setTotalNIM] = useState(0)
  const [showTipModal, setShowTipModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [milestoneState, setMilestoneState] = useState<{ prev: number; curr: number; event?: MilestoneEvent } | null>(null)
  const [supporters, setSupporters] = useState<{ address: string; totalNIM: number; tipCount: number }[]>([])

  const loadTips = useCallback(async () => {
    const res = await fetch(`/api/tips/${handle}`)
    if (!res.ok) return
    const data = (await res.json()) as { tips: Tip[]; supporters: (typeof supporters)[0][] }
    setTips(data.tips)
    const newTotal = data.tips.reduce((s, t) => s + (t.amountNIM || 0), 0)
    setTotalNIM(newTotal)
    setSupporters(data.supporters)
  }, [handle])

  useEffect(() => { loadTips() }, [loadTips])

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-white to-slate-50">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <header className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">{profile.displayName || `@${handle}`}</h1>
            {profile.bio && <p className="text-gray-600 max-w-prose">{profile.bio}</p>}
            {profile.achievement && <AchievementBanner achievement={profile.achievement} />}
            {profile.achievement && (
              <div className="inline-flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 text-sm text-slate-700">
                <span>🏆</span>
                <span>{profile.achievement}</span>
              </div>
            )}
            <div>
              <button
                onClick={() => setShowTipModal(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-sm"
              >
                Send a Tip
              </button>
            </div>
          </header>

          <StatsBlock totalNIM={totalNIM} tipCount={tips.length} />
          <GoalBar totalNIM={totalNIM} targetNIM={profile.goal?.targetNIM ?? 1000} label={profile.goal?.label || 'Goal'} />
          <MilestonesMeter totalNIM={totalNIM} />
          {profile.contentUrl && <ContentPreviewCard url={profile.contentUrl} />}
          <SupportersWall supporters={supporters} />
          <TipFeed tips={tips} />
          <Share copyUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/${handle}`} />
        </div>
      </div>
      {showTipModal && (
        <TipModal
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
          creatorHandle={handle}
          creatorWalletAddress={profile.walletAddress}
          onTipSuccess={async (tip) => {
            const prev = totalNIM
            const next = totalNIM + (tip.amountNIM || 0)
            setMilestoneState({ prev, curr: next })
            setShowTipModal(false)
            await loadTips()
          }}
        />
      )}
      {milestoneState && (
        <MilestoneCelebration
          previousTotal={milestoneState.prev}
          newTotal={milestoneState.curr}
        />
      )}
    </>
  )
}

function StatsBlock({ totalNIM, tipCount }: { totalNIM: number; tipCount: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="text-2xl font-semibold">{totalNIM.toLocaleString()}</div>
        <div className="text-xs text-gray-500 mt-0.5">NIM tipped</div>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="text-2xl font-semibold">{tipCount}</div>
        <div className="text-xs text-gray-500 mt-0.5">tips sent</div>
      </div>
    </div>
  )
}

function GoalBar({ totalNIM, targetNIM, label }: { totalNIM: number; targetNIM: number; label: string }) {
  const pct = Math.min(100, Math.round((totalNIM / targetNIM) * 100))
  const reached = totalNIM >= targetNIM
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={`${reached ? 'text-emerald-600' : 'text-yellow-700'} font-semibold`}>{pct}%</span>
      </div>
      <div className="h-3 w-full rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all ${reached ? 'bg-emerald-600' : 'bg-yellow-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function MilestonesMeter({ totalNIM }: { totalNIM: number }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {[100, 500, 1000, 5000, 10000].map((m) => (
        <div key={m} className={`rounded-xl py-2 text-center text-xs font-bold ${totalNIM >= m ? 'bg-yellow-400 text-slate-900' : 'bg-slate-100 text-slate-500'}`}>
          {m >= 1000 ? `${m / 1000}k` : m}
        </div>
      ))}
    </div>
  )
}

function Share({ copyUrl }: { copyUrl: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="w-full rounded-2xl bg-white p-4 text-sm text-gray-700 shadow-sm ring-1 ring-slate-200 hover:ring-slate-300"
      onClick={async () => { await navigator.clipboard.writeText(copyUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
    >
      {copied ? 'Link copied!' : 'Share this wall'}
    </button>
  )
}
