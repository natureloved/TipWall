'use client'
import { useState, useEffect, useCallback } from 'react'
import { type Tip, type MilestoneEvent } from '@/lib/types'
import ContentPreviewCard from '@/components/ContentPreviewCard'
import TipModal from '@/components/TipModal'
import MilestoneCelebration from '@/components/MilestoneCelebration'
import SupportersWall from '@/components/SupportersWall'
import TipFeed from '@/components/TipFeed'
import FloatingTips from '@/components/FloatingTips'
import AnimatedNumber from '@/components/AnimatedNumber'
import { useNimiqPay } from '@/hooks/useNimiqPay'
import InstallNimiqPrompt from '@/components/InstallNimiqPrompt'

export default function TipWallClient({ handle, initialProfile }: { handle: string; initialProfile: any }) {
  const [profile] = useState(initialProfile)
  const [tips, setTips] = useState<Tip[]>([])
  const [totalNIM, setTotalNIM] = useState(0)
  const [showTipModal, setShowTipModal] = useState(false)
  const [milestoneState, setMilestoneState] = useState<{ prev: number; curr: number; event?: MilestoneEvent } | null>(null)
  const [supporters, setSupporters] = useState<{ address: string; totalNIM: number; tipCount: number }[]>([])
  const [unlockedMilestones, setUnlockedMilestones] = useState<number[]>([])
  const [floatingTipTrigger, setFloatingTipTrigger] = useState(0)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const { isNimiqPay } = useNimiqPay()

  const loadTips = useCallback(async () => {
    const res = await fetch(`/api/tips/${handle}`)
    if (!res.ok) return
    const data = (await res.json()) as { tips: Tip[]; supporters: { address: string; totalNIM: number; tipCount: number }[] }
    setTips(data.tips)
    const newTotal = data.tips.reduce((sum, t) => sum + (t.amountNIM || 0), 0)
    setTotalNIM(newTotal)
    setSupporters(data.supporters)
    setUnlockedMilestones([100, 500, 1000, 5000, 10000].filter(m => newTotal >= m))
  }, [handle])

  useEffect(() => { loadTips() }, [loadTips])

  return (
    <>
      <FloatingTips trigger={floatingTipTrigger} />
      <div className="min-h-screen relative">
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-8 space-y-6">
          <div className="animate-glow rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-12 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial from-amber-400/20 to-transparent rounded-full animate-float blur-3xl" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-radial from-purple-400/10 to-transparent rounded-full animate-float" style={{ animationDelay: '2s', animationDirection: 'reverse' }} />

            <div className="relative z-10 space-y-4">
              <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent animate-slide-up">
                {profile.displayName || `@${handle}`}
              </h1>
              {profile.bio && (
                <p className="text-lg text-gray-100 max-w-lg animate-slide-up" style={{ animationDelay: '0.1s' }}>
                  {profile.bio}
                </p>
              )}
              {profile.achievement && (
                <div className="animate-pulse-custom inline-flex items-center gap-3 bg-amber-400/15 border-2 border-amber-400/40 rounded-xl px-4 py-2 text-sm font-semibold text-amber-300 cursor-pointer hover:bg-amber-400/25 hover:scale-105 transition-all" style={{ animationDelay: '0.2s' }}>
                  <span>🏆</span>
                  <span>{profile.achievement}</span>
                </div>
              )}
              <button
                onClick={() => {
                  if (!isNimiqPay) {
                    setShowInstallPrompt(true)
                  } else {
                    setShowTipModal(true)
                  }
                }}
                className="inline-block mt-4 px-5 py-2 text-sm rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl relative overflow-hidden group animate-slide-up"
                style={{ animationDelay: '0.3s' }}
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/30 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                {isNimiqPay ? 'Send a Tip' : '⚡ Open in Nimiq Pay'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <StatCard value={<AnimatedNumber value={totalNIM} />} label="NIM Tipped" index={0} />
            <StatCard value={<AnimatedNumber value={tips.length} />} label="Tips Sent" index={1} />
            <StatCard value={`${Math.min(100, Math.round((totalNIM / (profile.goal?.targetNIM ?? 1000)) * 100))}%`} label="Goal Progress" index={2} />
          </div>

          <SupportersWall supporters={supporters} />

          <div className="rounded-2xl bg-white p-6 shadow-lg hover:shadow-xl transition-all border-2 border-amber-400/10 hover:border-amber-400/30 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{profile.goal?.label || 'Goal'}</span>
              <span className="text-xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                {Math.min(100, Math.round((totalNIM / (profile.goal?.targetNIM ?? 1000)) * 100))}%
              </span>
            </div>
            <div className="relative w-full h-3 rounded-full overflow-hidden bg-gray-100">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-700 relative"
                style={{ width: `${Math.min(100, Math.round((totalNIM / (profile.goal?.targetNIM ?? 1000)) * 100))}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-lg border-2 border-amber-400/10 animate-slide-up" style={{ animationDelay: '0.5s' }}>
            <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Milestones</div>
            <div className="grid grid-cols-5 gap-2">
              {[100, 500, 1000, 5000, 10000].map((m, idx) => (
                <div
                  key={m}
                  className={`py-3 px-2 rounded-xl text-center font-semibold text-sm transition-all duration-300 cursor-pointer ${
                    unlockedMilestones.includes(m)
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 shadow-lg hover:shadow-xl animate-bounce-custom'
                      : 'bg-gray-50 text-gray-500 border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-100'
                  }`}
                  style={{ animationDelay: `${0.6 + idx * 0.05}s` }}
                >
                  {unlockedMilestones.includes(m) && <span className="text-xs mr-1">✓</span>}
                  {m >= 1000 ? `${m / 1000}k` : m}
                </div>
              ))}
            </div>
          </div>

          {profile.contentUrl && <ContentPreviewCard url={profile.contentUrl} />}

          <TipFeed tips={tips} />

          <ShareButton handle={handle} />
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
            setFloatingTipTrigger(t => t + 1)
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

      {showInstallPrompt && (
        <InstallNimiqPrompt
          url={typeof window !== 'undefined' ? window.location.origin : ''}
          onDismiss={() => setShowInstallPrompt(false)}
        />
      )}
    </>
  )
}

function StatCard({ value, label, index }: { value: React.ReactNode; label: string; index: number }) {
  return (
    <div
      className="relative group rounded-2xl bg-white p-6 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 border-amber-400/10 hover:border-amber-400/30 overflow-hidden animate-slide-up"
      style={{ animationDelay: `${0.35 + index * 0.05}s` }}
    >
      <div className="absolute inset-0 bg-gradient-radial from-amber-400/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10">
        <div className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
          {value}
        </div>
        <div className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mt-2">{label}</div>
      </div>
    </div>
  )
}

function ShareButton({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false)
  const copyUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/${handle}`

  return (
    <button
      className="w-full rounded-2xl bg-white p-6 text-center font-semibold text-gray-700 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-2 border-amber-400/10 hover:border-amber-400/30 animate-slide-up"
      style={{ animationDelay: '1.2s' }}
      onClick={async () => {
        await navigator.clipboard.writeText(copyUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? '✓ Link copied!' : '🔗 Share this wall'}
    </button>
  )
}
