'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getGoalMilestones, TIP_REASON_LABELS, type CreatorProfile, type Tip, type MilestoneEvent, type Supporter, type TipReason } from '@/lib/types'
import ContentPreviewCard from '@/components/ContentPreviewCard'
import TipModal from '@/components/TipModal'
import MilestoneCelebration from '@/components/MilestoneCelebration'
import SupportersWall from '@/components/SupportersWall'
import TipFeed from '@/components/TipFeed'
import FloatingTips from '@/components/FloatingTips'
import AnimatedNumber from '@/components/AnimatedNumber'
import FiatHint from '@/components/FiatHint'
import InstallNimiqPrompt from '@/components/InstallNimiqPrompt'
import SharePrompt from '@/components/SharePrompt'
import FirstVisitIntro from '@/components/FirstVisitIntro'
import { detectNimiqPay } from '@/lib/environment'
import { loadPendingTipIntent, clearPendingTipIntent } from '@/lib/tip-intent'
import { track } from '@/lib/analytics'
import { getNimiq, getSenderAddress } from '@/lib/nimiq'
import { normalizeAddress } from '@/lib/profile-auth'
import { timeAgo } from '@/lib/time'
import { useTranslations } from '@/lib/i18n'

export default function TipWallClient({ handle, initialProfile }: { handle: string; initialProfile: CreatorProfile }) {
  const profile = initialProfile
  const [tips, setTips] = useState<Tip[]>([])
  const [tipsLoading, setTipsLoading] = useState(true)
  const [tipsLoadError, setTipsLoadError] = useState(false)
  const [totalNIM, setTotalNIM] = useState(0)
  const [showTipModal, setShowTipModal] = useState(false)
  const [milestoneState, setMilestoneState] = useState<{ prev: number; curr: number; event?: MilestoneEvent } | null>(null)
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [unlockedMilestones, setUnlockedMilestones] = useState<number[]>([])
  const [floatingTipTrigger, setFloatingTipTrigger] = useState(0)
  const [nimiqAvailable, setNimiqAvailable] = useState<boolean | null>(null)
  const [walletBalanceNim, setWalletBalanceNim] = useState<number | null>(null)
  const [walletBalanceLoading, setWalletBalanceLoading] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [installIntent, setInstallIntent] = useState<{ amount?: number; message?: string; reason?: TipReason }>({})
  const [resume, setResume] = useState<{ amount?: number; message?: string } | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [sharePrompt, setSharePrompt] = useState<{ amount?: number } | null>(null)
  const [showMission, setShowMission] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [weeklyRank, setWeeklyRank] = useState<number | null>(null)
  const t = useTranslations()

  const loadTips = useCallback(() => {
    setTipsLoadError(false)
    return fetch(`/api/tips/${handle}`)
      .then(res => {
        if (!res.ok) throw new Error('tips unavailable')
        return res.json() as Promise<{ tips: Tip[]; supporters: Supporter[]; totalNIM: number }>
      })
      .then(data => {
        setTips(data.tips)
        // Use the server's verified-only total (pending/unverified tips don't count).
        const newTotal = data.totalNIM ?? data.tips.reduce((s, t) => s + (t.verified ? t.amountNIM || 0 : 0), 0)
        setTotalNIM(newTotal)
        setSupporters(data.supporters)
        setUnlockedMilestones(getGoalMilestones(profile.goal?.targetNIM ?? 1000).filter(m => newTotal >= m))
      })
      .catch(() => { setTipsLoadError(true) })
      .finally(() => setTipsLoading(false))
  }, [handle, profile.goal?.targetNIM])

  useEffect(() => {
    // Initial wall data is loaded from the API when the handle changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTips()
  }, [loadTips])

  // Live wall: a cheap head-id poll detects new tips; only then do we pay for
  // the full reload. Paused while the tab is hidden to save KV reads.
  useEffect(() => {
    let cancelled = false
    let lastHead: string | null = null
    const poll = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      try {
        const res = await fetch(`/api/tips/${handle}/live`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { headTipId: string | null }
        if (cancelled) return
        if (lastHead === null) { lastHead = data.headTipId; return }
        if (data.headTipId && data.headTipId !== lastHead) {
          lastHead = data.headTipId
          setFloatingTipTrigger(t => t + 1)
          await loadTips()
        }
      } catch {
        // A missed poll just retries on the next interval.
      }
    }
    const interval = setInterval(poll, 15000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [handle, loadTips])

  // Weekly leaderboard rank drives the growth loop: a ranked creator sees their
  // rank on their own wall and shares it. Fail silently - a leaderboard outage
  // must never affect the wall.
  useEffect(() => {
    let cancelled = false
    fetch('/api/leaderboard')
      .then(res => (res.ok ? (res.json() as Promise<{ handle: string; rank: number }[]>) : null))
      .then(rows => {
        if (cancelled || !rows) return
        const mine = rows.find(r => r.handle === handle)
        if (mine) setWeeklyRank(mine.rank)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [handle])

  // Balance is a read-only hint for the payment UI. Fetch it when the modal is
  // open so the state is fresh after a previous tip, and fail open if the RPC
  // is unavailable: the wallet remains the final authority at send time.
  useEffect(() => {
    if (nimiqAvailable !== true || !showTipModal) return
    let cancelled = false
    void Promise.resolve().then(async () => {
      if (cancelled) return
      setWalletBalanceLoading(true)
      try {
        const address = await getSenderAddress()
        if (!address) {
          if (!cancelled) setWalletBalanceNim(null)
          return
        }
        const response = await fetch(`/api/wallet/balance?address=${encodeURIComponent(address)}`)
        const data = response.ok ? await response.json() as { balanceNIM?: number } : null
        if (!cancelled) setWalletBalanceNim(data && typeof data.balanceNIM === 'number' ? data.balanceNIM : null)
      } catch {
        if (!cancelled) setWalletBalanceNim(null)
      } finally {
        if (!cancelled) setWalletBalanceLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [nimiqAvailable, showTipModal])

  // Check if connected wallet is the owner for dashboard link. Only ever true
  // inside Nimiq Pay (getNimiq() rejects on desktop); the footer link below is
  // the desktop fallback. Compare normalized - canonical Nimiq addresses carry
  // spaces, so a raw string compare can miss the true owner.
  useEffect(() => {
    let cancelled = false
    getNimiq().then((nimiq) => nimiq.listAccounts().then((accounts) => {
      const raw = Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : null
      if (!cancelled && raw && normalizeAddress(raw) === normalizeAddress(profile.walletAddress)) {
        setIsOwner(true)
      }
    })).catch(() => {})
    return () => { cancelled = true }
  }, [profile.walletAddress])

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

  // True progress can exceed 100% when a creator beats their goal - keep that figure
  // for the label so overachievement is visible. The bar itself stays capped at 100%
  // (a bar past full looks broken).
  const goalPercentTrue = Math.round((totalNIM / (profile.goal?.targetNIM ?? 1000)) * 100)
  const goalPercent = Math.min(100, goalPercentTrue)
  const goalSmashed = goalPercentTrue > 100
  const goalMilestones = getGoalMilestones(profile.goal?.targetNIM ?? 1000)
  // An empty wall shows a single warm invitation instead of five stacked zeros.
  // The full dashboard (stats, supporters, goal, milestones, feed) unlocks with
  // the first tip - so tip #1 visibly turns the wall on.
  const hasTips = tips.length > 0
  // Most recent tip time for the "Last tip" stat tile. Tips arrive newest-first
  // from the API, but reduce over all of them so we don't depend on order.
  const lastTipAt = hasTips ? tips.reduce((max, t) => Math.max(max, t.timestamp), 0) : null
  const reasonCounts = (Object.keys(TIP_REASON_LABELS) as TipReason[]).map(reason => ({ reason, count: tips.filter(t => t.verified && t.reason === reason).length })).sort((a, b) => b.count - a.count)
  const topReason = reasonCounts[0]?.count ? reasonCounts[0] : null

  return (
    <>
      <FloatingTips trigger={floatingTipTrigger} />
      <div className="tw-wall min-h-screen relative" data-theme={profile.theme || 'paper'}>
        {/* Fixed, opaque wall backdrop - painted from first frame (see .tw-wall
            in globals.css) so translucent cards never flash washed-out. */}
        <div className="tw-wall fixed inset-0 z-0" />

        {/* Owner-only management controls - hidden from supporters so the hero
            stays clean and no admin surface is advertised to visitors. */}
        {isOwner && (
          <div className="fixed bottom-24 right-4 z-30 flex flex-col items-end gap-2 sm:bottom-4">
            {manageOpen && (
              <div className="flex flex-col gap-1.5 rounded-2xl bg-slate-800/90 backdrop-blur border border-white/10 p-2 shadow-2xl animate-slide-up">
                <a href={`/${handle}/dashboard`} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:bg-white/10 transition-colors">📊 Dashboard</a>
                <a href={`/${handle}/analytics`} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:bg-white/10 transition-colors">📈 Analytics</a>
                <a href={`/${handle}/edit`} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:bg-white/10 transition-colors">✏️ Edit wall</a>
                <a href={`/${handle}/overlay`} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:bg-white/10 transition-colors">🎥 Stream overlay</a>
              </div>
            )}
            <button
              onClick={() => setManageOpen(v => !v)}
              aria-expanded={manageOpen}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-slate-900 bg-gradient-to-r from-amber-400 to-amber-500 shadow-xl hover:shadow-2xl hover:from-amber-500 hover:to-amber-600 transition-all"
            >
              ⚙️ Manage
            </button>
          </div>
        )}

        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-8 space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-4">
            <Link href="/" className="brand-logo-inline"><Image src="/logo.svg" alt="TipWall logo" width={34} height={34} />TipWall</Link>
            <Link href="/explore" className="text-sm font-semibold text-slate-400">Explore walls</Link>
          </header>
          {/* Hero Section */}
          <div className="creator-wall-hero animate-glow relative overflow-hidden rounded-3xl bg-[#fffaf0] p-6 text-[#171614] sm:p-8">
            <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10">

              {/* Identity */}
              <div className="min-w-0 sm:flex-1 space-y-3">
                <p className="creator-wall-eyebrow">Public support wall</p>
                {weeklyRank !== null && (
                  <Link
                    href="/explore"
                    className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full bg-sky-400/15 border border-sky-400/40 px-3 py-1 text-xs font-bold text-sky-300 hover:bg-sky-400/25 transition-colors animate-slide-up"
                  >
                    🔥 #{weeklyRank} most tipped this week
                  </Link>
                )}
                <div className="flex items-center gap-3 space-y-1 animate-slide-up">
                  {profile.avatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- creator-provided public avatar URL
                    <img src={profile.avatarUrl} alt="" className="h-14 w-14 shrink-0 rounded-full border-2 border-[#171614] object-cover shadow-[3px_3px_0_#171614]" width={56} height={56} />
                  )}
                  <div className="min-w-0">
                  <h1 className="creator-wall-name text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight break-words">
                    {profile.displayName || `@${handle}`}
                  </h1>
                  {profile.displayName && (
                    <p className="text-sm text-slate-400">@{handle}</p>
                  )}
                  </div>
                </div>

                {profile.bio && (
                  <p className="text-base sm:text-lg text-gray-100 max-w-prose animate-slide-up" style={{animationDelay: '0.1s'}}>
                    {profile.bio}
                  </p>
                )}

                {profile.achievement && (
                  <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-amber-400/15 border border-amber-400/40 px-3 py-1.5 text-sm font-semibold text-amber-300 animate-slide-up" style={{animationDelay: '0.2s'}}>
                    <span className="shrink-0">🏆</span>
                    <span className="truncate">{profile.achievement}</span>
                  </div>
                )}
                {profile.socialLinks && Object.values(profile.socialLinks).some(Boolean) && (
                  <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[#2d697c]" aria-label="Public links">
                    {Object.entries(profile.socialLinks).filter(([, url]) => Boolean(url)).map(([key, url]) => <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-[#b9382a]">{key === 'x' ? 'X' : key[0].toUpperCase() + key.slice(1)} ↗</a>)}
                  </nav>
                )}
              </div>

              {/* Actions */}
              <div className="w-full sm:w-auto sm:shrink-0 sm:min-w-[260px] space-y-3">
                <button
                  onClick={() => { track(handle, 'TIP_BUTTON_CLICKED'); setShowTipModal(true) }}
                  className="group relative w-full inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl px-8 py-4 text-lg font-bold text-slate-900 bg-gradient-to-r from-amber-400 to-amber-500 shadow-xl transition-all duration-300 hover:from-amber-500 hover:to-amber-600 hover:shadow-2xl animate-slide-up"
                  style={{animationDelay: '0.3s'}}
                >
                  <span className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-white/0 to-white/30 transition-transform duration-500 group-hover:translate-x-[100%]" />
                  <span className="text-xl">💸</span>
                  {t('sendTip')}
                </button>

                <div className="flex items-center justify-center gap-3 text-sm text-slate-400 animate-slide-up" style={{animationDelay: '0.32s'}}>
                  <button
                    onClick={() => setShowMission(true)}
                    className="underline underline-offset-4 transition-colors hover:text-amber-300"
                  >
                    {t('whatIsTipWall')}
                  </button>
                  <span aria-hidden className="text-white/20">·</span>
                  <a
                    href={`/${handle}/share`}
                    className="underline underline-offset-4 transition-colors hover:text-amber-300"
                  >
                    Share
                  </a>
                </div>
              </div>
            </div>
          </div>

          {tipsLoading ? (
            <div className="wall-content-loading" role="status" aria-live="polite"><span className="wall-loading-spinner" /><p>Opening the appreciation wall...</p></div>
          ) : tipsLoadError ? (
            <div className="empty-appreciation-board rounded-2xl bg-slate-800/60 backdrop-blur p-8 text-center shadow-lg border-2 border-[#d36b61] animate-slide-up" role="alert">
              <div className="text-4xl mb-3">!</div>
              <h2 className="text-xl font-bold text-white mb-2">The wall could not load</h2>
              <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">Your wall and tips are safe. Please try again.</p>
              <button onClick={() => { setTipsLoading(true); void loadTips() }} className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-slate-900 bg-amber-400 hover:bg-amber-500 transition-colors">Try again</button>
            </div>
          ) : !hasTips ? (
            /* Empty wall: one warm invitation, no wall of zeros. */
            <div className="empty-appreciation-board rounded-2xl bg-slate-800/60 backdrop-blur p-8 text-center shadow-lg border-2 border-amber-400/20 animate-slide-up" style={{animationDelay: '0.35s'}}>
              <div className="text-5xl mb-4">🤝</div>
              <h2 className="text-xl font-bold text-white mb-2">
                {t('beFirstToSupport', { name: profile.displayName || `@${handle}` })}
              </h2>
              <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
                {t('zeroFees')}
              </p>
              <div className="appreciation-prompts" aria-label="Examples of feedback reasons"><span>💡 Helpful content</span><span>📚 Tutorial</span><span>⚡ Great idea</span><span>💗 Just support</span></div>
              <button
                onClick={() => { track(handle, 'TIP_BUTTON_CLICKED'); setShowTipModal(true) }}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg rounded-2xl font-bold text-slate-900 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl"
              >
                <span className="text-xl">💸</span>
                {t('sendTip')}
              </button>
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <StatCard value={<><AnimatedNumber value={totalNIM} /><FiatHint nim={totalNIM} className="ml-1.5 align-middle text-[10px] min-[375px]:text-xs sm:text-base font-semibold text-slate-500" /></>} label={t('totalTipped')} index={0} />
                <StatCard value={<AnimatedNumber value={tips.length} />} label={t('tipsSent')} index={1} />
                <StatCard value={lastTipAt ? timeAgo(lastTipAt).replace(' ago', '').replace('just now', 'now') : 'No tips yet'} label={t('lastTip')} index={2} suppressHydrationWarning />
              </div>

              {/* The feed is the heart of the wall - it leads, right after stats. */}
              <TipFeed tips={tips} />

              {/* Goal + milestones share one compact card (only when a goal exists). */}
              {profile.goal && (
                <GoalCard
                  label={profile.goal.label || 'Goal'}
                  percentTrue={goalPercentTrue}
                  percent={goalPercent}
                  smashed={goalSmashed}
                  milestones={goalMilestones}
                  unlocked={unlockedMilestones}
                />
              )}

              {/* Supporters collapse to a count row - full grid one tap away. */}
              <SupportersWall supporters={supporters} collapsible />

              {/* Content Preview */}
              {profile.contentUrl && <ContentPreviewCard url={profile.contentUrl} handle={handle} />}

              {topReason && (
                <div className="surface-soft rounded-2xl px-5 py-4 flex items-center gap-3 animate-slide-up">
                  <span className="text-2xl">{TIP_REASON_LABELS[topReason.reason].emoji}</span>
                  <div className="min-w-0"><p className="text-[11px] uppercase tracking-wide font-bold text-sky-300">What your audience values</p><p className="text-sm text-slate-200 mt-0.5">Supporters most often come for <strong>{TIP_REASON_LABELS[topReason.reason].label.toLowerCase()}</strong>.</p></div>
                </div>
              )}
            </>
          )}

          {/* Share Button */}
          <ShareButton handle={handle} />

          {/* Viral footer: every wall is a doorway into the rest */}
          <p className="text-center text-xs text-slate-400 pb-24 sm:pb-4">
            Powered by <Link href="/" className="underline underline-offset-4 hover:text-amber-300 transition-colors">TipWall</Link>
            {' · '}
            <Link href="/explore" className="underline underline-offset-4 hover:text-amber-300 transition-colors">Explore walls</Link>
            {/* Desktop fallback: detected owners get the Manage pill (better UX
                inside Nimiq Pay); everyone else keeps this low-key path in.
                The pages behind it are signature-gated server-side. */}
            {!isOwner && (
              <>
                {' · '}
                <a href={`/${handle}/edit`} className="underline underline-offset-4 hover:text-amber-300 transition-colors">
                  Wall owner? Manage this wall
                </a>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="creator-sticky-tip sticky-tip-cta fixed bottom-0 inset-x-0 z-20 px-4 pt-3 backdrop-blur border-t sm:hidden">
        <button onClick={() => { track(handle, 'TIP_BUTTON_CLICKED'); setShowTipModal(true) }} className="w-full rounded-2xl bg-amber-400 py-3.5 font-bold text-slate-900 shadow-xl">💸 Send a tip + feedback</button>
      </div>

      {showTipModal && (
        <TipModal
          key={resume ? 'resume' : 'fresh'}
          isOpen={showTipModal}
          onClose={() => { setShowTipModal(false); setResume(null) }}
          creatorHandle={handle}
          creatorWalletAddress={profile.walletAddress}
          creatorUsdtAddress={profile.usdtPolygonAddress}
          creatorDisplayName={profile.displayName}
          nimiqAvailable={nimiqAvailable}
          goal={profile.goal}
          totalNIM={totalNIM}
          initialAmount={resume?.amount}
          initialMessage={resume?.message}
          welcome={!!resume}
          walletBalanceNim={walletBalanceNim}
          walletBalanceLoading={walletBalanceLoading}
          onNeedsInstall={(amount, message, reason) => {
            setInstallIntent({ amount, message, reason })
            setShowTipModal(false)
            setResume(null)
            setShowInstall(true)
            track(handle, 'INSTALL_PROMPT_SHOWN')
          }}
          onTipSuccess={async (tip) => {
            if (tip.pending) {
              // The payment reference was recorded, but the chain indexer has
              // not confirmed it yet. Keep the tip visible as pending and wait
              // for a verified live update before celebrating it.
              setShowTipModal(false)
              setResume(null)
              await loadTips()
              return
            }
            const prev = totalNIM
            const next = totalNIM + (tip.amountNIM || 0)
            setMilestoneState({ prev, curr: next })
            setFloatingTipTrigger(t => t + 1)
            setShowTipModal(false)
            setResume(null)
            // Invite the supporter to announce their tip - supporters sharing
            // is the wall's most credible distribution channel.
            if (tip.asset !== 'USDT') setSharePrompt({ amount: tip.amountNIM })
            await loadTips()
          }}
        />
      )}
      {showInstall && (
        <InstallNimiqPrompt
          creatorHandle={handle}
          creatorWalletAddress={profile.walletAddress}
          amountNIM={installIntent.amount}
          message={installIntent.message}
          reason={installIntent.reason}
          onClose={() => setShowInstall(false)}
          onTipSuccess={async (tip) => {
            setShowInstall(false)
            if (tip.pending) {
              await loadTips()
              return
            }
            const prev = totalNIM
            const next = totalNIM + (tip.amountNIM || 0)
            setMilestoneState({ prev, curr: next })
            setFloatingTipTrigger(t => t + 1)
            setSharePrompt({ amount: tip.amountNIM })
            await loadTips()
          }}
        />
      )}
      {milestoneState && (
        <MilestoneCelebration
          key={milestoneState.curr}
          previousTotal={milestoneState.prev}
          newTotal={milestoneState.curr}
          milestones={goalMilestones}
          handle={handle}
        />
      )}
      {sharePrompt && (
        <SharePrompt
          handle={handle}
          amountNIM={sharePrompt.amount}
          onClose={() => setSharePrompt(null)}
        />
      )}
      {showMission && (
        <FirstVisitIntro
          forceOpen
          onClose={() => setShowMission(false)}
          onStart={() => { setShowMission(false); track(handle, 'TIP_BUTTON_CLICKED'); setShowTipModal(true) }}
        />
      )}
    </>
  )
}

function StatCard({ value, label, index, suppressHydrationWarning }: { value: React.ReactNode; label: string; index: number; suppressHydrationWarning?: boolean }) {
  return (
    <div
      className="relative group min-w-0 rounded-xl bg-slate-800/60 backdrop-blur p-2.5 min-[375px]:p-3 sm:rounded-2xl sm:p-6 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 border-amber-400/10 hover:border-amber-400/30 overflow-hidden animate-slide-up"
      style={{animationDelay: `${0.35 + index * 0.05}s`}}
    >
      <div className="absolute inset-0 bg-gradient-radial from-amber-400/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10">
        <div className="min-w-0 whitespace-nowrap text-base min-[375px]:text-lg sm:text-4xl font-bold leading-tight tabular-nums bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent" suppressHydrationWarning={suppressHydrationWarning}>
          {value}
        </div>
        <div className="mt-1.5 whitespace-nowrap text-[9px] min-[375px]:text-[10px] sm:mt-2 sm:text-sm font-semibold leading-tight text-slate-400 uppercase">{label}</div>
      </div>
    </div>
  )
}

function GoalCard({ label, percentTrue, percent, smashed, milestones, unlocked }: {
  label: string
  percentTrue: number
  percent: number
  smashed: boolean
  milestones: number[]
  unlocked: number[]
}) {
  const t = useTranslations()
  return (
    <div className="rounded-2xl bg-slate-800/60 backdrop-blur p-6 shadow-lg hover:shadow-xl transition-all border-2 border-amber-400/10 hover:border-amber-400/30 animate-slide-up" style={{animationDelay: '0.4s'}}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
        <span className="text-xl font-bold bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
          {percentTrue}%{smashed && <span className="ml-1 text-sm font-semibold text-amber-300">· goal smashed 🎉</span>}
        </span>
      </div>
      <div
        className="relative w-full h-3 rounded-full overflow-hidden bg-white/10"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-700 relative"
          style={{ width: `${percent}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1.5" aria-label={t('milestones')}>
        {milestones.map(m => (
          <span
            key={m}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
              unlocked.includes(m)
                ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 shadow'
                : 'bg-white/5 text-slate-500 border border-white/10'
            }`}
          >
            {unlocked.includes(m) && <span className="mr-0.5" aria-label="unlocked">✓</span>}
            {m >= 1000 ? `${(m / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k` : m}
          </span>
        ))}
      </div>
    </div>
  )
}

function ShareButton({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false)
  const t = useTranslations()
  const copyUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/${handle}`

  return (
    <button
      className="flex items-center justify-center gap-2 mx-auto w-auto rounded-full bg-transparent px-6 py-3 text-sm font-semibold text-amber-300 border-2 border-amber-400/40 hover:bg-amber-400/10 hover:border-amber-400/60 transition-colors duration-200 animate-slide-up"
      style={{animationDelay: '0.4s'}}
      onClick={async () => {
        await navigator.clipboard.writeText(copyUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? t('linkCopied') : `🔗 ${t('share')}`}
    </button>
  )
}
