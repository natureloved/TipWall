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
import InstallNimiqPrompt from '@/components/InstallNimiqPrompt'
import { detectNimiqPay } from '@/lib/environment'
import { loadPendingTipIntent, clearPendingTipIntent } from '@/lib/tip-intent'
import { track } from '@/lib/analytics'

export default function TipWallClient({ handle, initialProfile }: { handle: string; initialProfile: any }) {
  const [profile, setProfile] = useState(initialProfile)
  const [tips, setTips] = useState<Tip[]>([])
  const [totalNIM, setTotalNIM] = useState(0)
  const [showTipModal, setShowTipModal] = useState(false)
  const [milestoneState, setMilestoneState] = useState<{ prev: number; curr: number; event?: MilestoneEvent } | null>(null)
  const [supporters, setSupporters] = useState<{ address: string; totalNIM: number; tipCount: number }[]>([])
  const [unlockedMilestones, setUnlockedMilestones] = useState<number[]>([])
  const [floatingTipTrigger, setFloatingTipTrigger] = useState(0)
  // Onboarding / tip-recovery state
  const [nimiqAvailable, setNimiqAvailable] = useState<boolean | null>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [installAmount, setInstallAmount] = useState<number | undefined>(undefined)
  const [resume, setResume] = useState<{ amount?: number; message?: string } | null>(null)

  const loadTips = useCallback(async () => {
    const res = await fetch(`/api/tips/${handle}`)
    if (!res.ok) return
    const data = (await res.json()) as { tips: Tip[]; supporters: (typeof supporters)[0][] }
    setTips(data.tips)
    const newTotal = data.tips.reduce((s, t) => s + (t.amountNIM || 0), 0)
    setTotalNIM(newTotal)
    setSupporters(data.supporters)
    setUnlockedMilestones([100, 500, 1000, 5000, 10000].filter(m => newTotal >= m))
  }, [handle])

  useEffect(() => { loadTips() }, [loadTips])

  // Detect whether we are inside Nimiq Pay, then resume any preserved tip
  // intent for this creator (same-browser recovery after onboarding).
  useEffect(() => {
    let cancelled = false
    detectNimiqPay().then((available) => {
      if (cancelled) return
      setNimiqAvailable(available)
      track(handle, 'TIP_WALL_VIEWED')
      const pending = loadPendingTipIntent()
      if (pending && pending.creatorHandle === handle) {
        setResume({ amount: pending.amountNIM, message: pending.message })
        setShowTipModal(true)
        clearPendingTipIntent()
        track(handle, 'RETURNED_AFTER_INSTALL')
      }
    })
    return () => { cancelled = true }
  }, [handle])

  return (
    <>
      <FloatingTips trigger={floatingTipTrigger} />
      <div className="min-h-screen relative">
        {/* Animated background gradient */}
        <div className="fixed inset-0 z-0" />
        
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-8 space-y-6">
          {/* Hero Section */}
          <div className="animate-glow rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-12 text-white overflow-hidden relative">
            {/* Animated background orbs */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial from-amber-400/20 to-transparent rounded-full animate-float blur-3xl" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-radial from-purple-400/10 to-transparent rounded-full animate-float" style={{animationDelay: '2s', animationDirection: 'reverse'}} />
            
            <div className="relative z-10 space-y-4">
              <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent animate-slide-up">
                {profile.displayName || `@${handle}`}
              </h1>
              {profile.bio && (
                <p className="text-lg text-gray-100 max-w-lg animate-slide-up" style={{animationDelay: '0.1s'}}>
                  {profile.bio}
                </p>
              )}
{profile.achievement && (
                 <div className="animate-pulse-custom inline-flex items-center gap-3 bg-amber-400/15 border-2 border-amber-400/40 rounded-xl px-4 py-2 text-sm font-semibold text-amber-300 cursor-pointer hover:bg-amber-400/25 hover:scale-105 transition-all" style={{animationDelay: '0.2s'}}>
                   <span>🏆</span>
                   <span>{profile.achievement}</span>
                 </div>
               )}
               <button
                 onClick={() => { track(handle, 'TIP_BUTTON_CLICKED'); setShowTipModal(true) }}
                 className="inline-block mt-4 px-5 py-2 text-sm rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl relative overflow-hidden group animate-slide-up"
                 style={{animationDelay: '0.3s'}}
               >
                 <span className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/30 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                 Send a Tip
               </button>
               <a
                 href={`/${handle}/edit`}
                 className="inline-block mt-4 ml-3 text-xs text-slate-400 hover:text-amber-300 underline underline-offset-4 transition-colors"
               >
                 Owner? Edit this wall
               </a>
               <a
                 href={`/${handle}/analytics`}
                 className="inline-block mt-4 ml-3 text-xs text-slate-400 hover:text-amber-300 underline underline-offset-4 transition-colors"
               >
                 Analytics
               </a>
            </div>
          </div>

{/* Stats Grid */}
           <div className="grid grid-cols-3 gap-4">
             <StatCard value={<AnimatedNumber value={totalNIM} />} label="NIM Tipped" index={0} />
             <StatCard value={<AnimatedNumber value={tips.length} />} label="Tips Sent" index={1} />
             <StatCard value={`${Math.min(100, Math.round((totalNIM / (profile.goal?.targetNIM ?? 1000)) * 100))}%`} label="Goal Progress" index={2} />
           </div>

           {/* Supporters - prominently displayed for community recognition */}
           <SupportersWall supporters={supporters} />

           {/* Goal Progress */}
           <div className="rounded-2xl bg-white p-6 shadow-lg hover:shadow-xl transition-all border-2 border-amber-400/10 hover:border-amber-400/30 animate-slide-up" style={{animationDelay: '0.4s'}}>
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

           {/* Milestones */}
           <div className="rounded-2xl bg-white p-6 shadow-lg border-2 border-amber-400/10 animate-slide-up" style={{animationDelay: '0.5s'}}>
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
                   style={{animationDelay: `${0.6 + idx * 0.05}s`}}
                 >
                   {unlockedMilestones.includes(m) && <span className="text-xs mr-1">✓</span>}
                   {m >= 1000 ? `${m / 1000}k` : m}
                 </div>
               ))}
             </div>
           </div>

           {/* Content Preview */}
           {profile.contentUrl && <ContentPreviewCard url={profile.contentUrl} />}

           {/* Live Feed */}
           <TipFeed tips={tips} />

          {/* Share Button */}
          <ShareButton handle={handle} />
        </div>
      </div>

      {showTipModal && (
        <TipModal
          key={resume ? 'resume' : 'fresh'}
          isOpen={showTipModal}
          onClose={() => { setShowTipModal(false); setResume(null) }}
          creatorHandle={handle}
          creatorWalletAddress={profile.walletAddress}
          nimiqAvailable={nimiqAvailable}
          initialAmount={resume?.amount}
          initialMessage={resume?.message}
          welcome={!!resume}
          onNeedsInstall={(amount) => {
            setInstallAmount(amount)
            setShowTipModal(false)
            setResume(null)
            setShowInstall(true)
            track(handle, 'INSTALL_PROMPT_SHOWN')
          }}
          onTipSuccess={async (tip) => {
            const prev = totalNIM
            const next = totalNIM + (tip.amountNIM || 0)
            setMilestoneState({ prev, curr: next })
            setFloatingTipTrigger(t => t + 1)
            setShowTipModal(false)
            setResume(null)
            await loadTips()
          }}
        />
      )}
      {showInstall && (
        <InstallNimiqPrompt
          creatorHandle={handle}
          amountNIM={installAmount}
          onClose={() => setShowInstall(false)}
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

function StatCard({ value, label, index }: { value: any; label: string; index: number }) {
  return (
    <div
      className="relative group rounded-2xl bg-white p-6 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 border-amber-400/10 hover:border-amber-400/30 overflow-hidden animate-slide-up"
      style={{animationDelay: `${0.35 + index * 0.05}s`}}
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
      style={{animationDelay: '1.2s'}}
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
