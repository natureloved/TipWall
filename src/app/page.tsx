'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { connectWallet, signProfileAuth } from '@/lib/nimiq'
import { normalizeHandle } from '@/lib/profile-auth'
import MissionLink from '@/components/MissionLink'
import EcosystemStats from '@/components/EcosystemStats'

const PLACEHOLDER_TEXT = 'e.g. "Building an AI agent"'

export default function CreatorSetup() {
  const [handle, setHandle] = useState('')
  const [wallet, setWallet] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [contentUrl, setContentUrl] = useState('')
  const [goalLabel, setGoalLabel] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [achievement, setAchievement] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  // Live handle availability
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const checkTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setupRef = useRef<HTMLFormElement>(null)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const normalized = normalizeHandle(handle)
    if (normalized.length < 3) { setHandleStatus('idle'); return }
    setHandleStatus('checking')
    if (checkTimeout.current) clearTimeout(checkTimeout.current)
    checkTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profile/${normalized}`)
        setHandleStatus(res.status === 404 ? 'available' : 'taken')
      } catch {
        setHandleStatus('idle')
      }
    }, 400)
    return () => { if (checkTimeout.current) clearTimeout(checkTimeout.current) }
  }, [handle])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleConnect = async () => {
    setError(null)
    setConnecting(true)
    try {
      const address = await connectWallet()
      setWallet(address)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect wallet')
    } finally {
      setConnecting(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const handleStr = normalizeHandle(handle)
    if (handleStr.length < 3) { setError('Handle must be at least 3 characters'); return }
    if (!wallet) { setError('Connect your Nimiq wallet first'); return }

    setSubmitting(true)
    try {
      const auth = await signProfileAuth({ action: 'create', handle: handleStr, walletAddress: wallet })
      const res = await fetch('/api/profile/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: handleStr,
          walletAddress: wallet,
          displayName: displayName || handleStr,
          bio,
          contentUrl,
          // Goal is optional — only send it when the creator filled both fields.
          ...(goalTarget.trim() && goalLabel.trim()
            ? { goal: { label: goalLabel.trim(), targetNIM: parseInt(goalTarget) || undefined } }
            : {}),
          achievement: achievement || undefined,
          auth,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.error === 'Handle already taken') {
          setError('Handle already taken — checking if you already have a TipWall...')
          try {
            const viewAuth = await signProfileAuth({ action: 'view', handle: '', walletAddress: wallet })
            const viewAuthHeader = btoa(JSON.stringify(viewAuth))
            const walletRes = await fetch(`/api/profile/wallet?address=${wallet}`, {
              headers: { 'x-tipwall-auth': viewAuthHeader },
            })
            if (walletRes.ok) {
              const walletData = await walletRes.json()
              window.location.href = `/${walletData.handle}`
              return
            }
          } catch { /* fall through */ }
        }
        throw new Error(data.error)
      }
      window.location.href = `/${data.handle}/share?new=1`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile')
      setSubmitting(false)
    }
  }

  const normalizedHandle = normalizeHandle(handle)

  return (
    <div className="app-shell min-h-screen text-white flex flex-col items-center px-4 sm:px-8">
      <header className="w-full max-w-6xl py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold"><span className="grid place-items-center h-8 w-8 rounded-lg bg-amber-400 text-slate-950">T</span>TipWall</Link>
        <div className="flex items-center gap-4 text-sm"><Link href="/explore" className="text-slate-300 hover:text-white">Explore</Link><button onClick={() => setupRef.current?.scrollIntoView({ behavior: 'smooth' })} className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-slate-950">Create a wall</button></div>
      </header>
      {/* Hero */}
      <div className="w-full max-w-6xl grid gap-12 lg:grid-cols-[0.9fr_1.1fr] items-center py-10 sm:py-20">
      <div className="text-left">
        <p className="inline-flex rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-sky-200 font-bold mb-5">Support that says something</p>
        <h1 className="text-5xl sm:text-7xl leading-[1.02] font-bold tracking-tight text-white mb-6">
          More than<br /><span className="text-amber-300">a tip jar.</span>
        </h1>
        <p className="text-slate-300 text-lg sm:text-xl max-w-xl mb-4">
          Give your audience a direct way to fund your work and tell you why it matters. Every NIM goes to you. Every reason becomes insight.
        </p>
        <p className="text-amber-300 font-semibold text-sm mb-5">0% platform fee · On-chain verified · Audience insight</p>
        <div className="flex flex-wrap gap-3 mb-5"><button onClick={() => setupRef.current?.scrollIntoView({ behavior: 'smooth' })} className="rounded-xl bg-amber-400 px-6 py-3.5 font-bold text-slate-950 hover:bg-amber-300">Create your wall</button><Link href="/explore" className="rounded-xl border border-slate-600 px-6 py-3.5 font-semibold hover:border-slate-400">Discover creators</Link></div>
        <div className="text-sm">
          <MissionLink labelKey="learnAboutTipWall" variant="home" />
        </div>
      </div>

      <div className="relative lg:pl-6">
        <div className="absolute -inset-5 rounded-full bg-amber-400/10 blur-3xl" aria-hidden="true" />
        <div className="relative overflow-hidden rounded-2xl border border-slate-600 bg-[#171b22] shadow-2xl"><Image src="/promo/screenshot-wall.png" alt="A creator's TipWall with direct tipping and supporter feedback" width={1200} height={800} priority className="w-full h-auto" /></div>
        <div className="relative sm:absolute sm:-left-5 sm:bottom-6 mt-3 sm:mt-0 max-w-xs rounded-2xl border border-sky-400/30 bg-[#171b22]/95 p-4 shadow-xl backdrop-blur"><p className="text-[11px] uppercase tracking-wide text-sky-300 font-bold">Audience signal</p><p className="mt-1 text-sm text-white">Your tutorial saved me hours.</p><p className="mt-2 text-xs text-sky-200">Helpful content · 10 NIM</p></div>
      </div>
      <div className="hidden">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div><p className="font-bold text-white">Maya builds in public</p><p className="text-xs text-slate-500">@mayabuilds</p></div>
          <span className="text-xs font-bold text-emerald-300">● Live wall</span>
        </div>
        <div className="rounded-2xl bg-sky-400/10 border border-sky-400/25 p-4 mb-4"><p className="text-[11px] uppercase tracking-wide text-sky-300 font-bold">Audience signal</p><p className="text-sm text-slate-100 mt-1">People support Maya most for <strong>helpful content</strong>.</p><p className="text-xs text-slate-400 mt-2">18 tips · 420 NIM</p></div>
        <div className="space-y-3"><div className="rounded-xl bg-[#202631] p-3"><p className="text-sm text-slate-200">“Your tutorial saved me hours.”</p><p className="text-xs text-sky-300 mt-2">💡 Helpful content · 10 NIM</p></div><div className="rounded-xl bg-[#202631] p-3"><p className="text-sm text-slate-200">“Keep building. This is a great idea.”</p><p className="text-xs text-sky-300 mt-2">⚡ Great idea · 25 NIM</p></div></div>
        <div className="mt-5 w-full rounded-xl bg-amber-400 py-3 text-center font-bold text-slate-900">Send a tip + feedback</div>
      </div>
      </div>

      {/* Audience router — name both paths so first-time visitors know which one they are */}
      <div className="w-full max-w-md mb-6">
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-4 py-3 text-sm text-slate-300 text-center leading-relaxed">
          <span className="font-semibold text-white">Creating a wall?</span> Fill it out below.
          <span className="hidden sm:inline text-slate-600" aria-hidden="true"> · </span>
          <br className="sm:hidden" />
          <span className="font-semibold text-white">Here to support?</span>{' '}
          <Link
            href="/explore"
            className="text-amber-300 hover:text-amber-200 font-semibold underline underline-offset-4 transition-colors"
          >
            Explore walls →
          </Link>
        </div>
      </div>

      {/* Live social proof — proves the network is real before asking for a signup */}
      <EcosystemStats />

      <form ref={setupRef} onSubmit={submit} className="surface w-full max-w-md rounded-2xl p-6 space-y-4 scroll-mt-6">
        <div><p className="text-xs uppercase tracking-wide text-sky-300 font-bold">Create your wall</p><h2 className="text-2xl font-bold mt-1">Start with your creator identity.</h2><p className="text-sm text-slate-400 mt-1">You can add the details later.</p></div>
        {/* Handle */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Handle <span className="text-slate-400">(tipwall.vercel.app/yourname)</span>
          </label>
          <input
            value={handle}
            onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            placeholder="yourname"
            className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white"
            required
          />
          {normalizedHandle.length >= 3 && (
            <p className={`text-[11px] mt-1 ${
              handleStatus === 'available' ? 'text-emerald-400' :
              handleStatus === 'taken' ? 'text-red-400' :
              'text-slate-500'
            }`}>
              {handleStatus === 'checking' && 'Checking…'}
              {handleStatus === 'available' && `✓ tipwall.vercel.app/${normalizedHandle} is available`}
              {handleStatus === 'taken' && `✗ ${normalizedHandle} is already taken`}
            </p>
          )}
        </div>

        {/* Wallet */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Nimiq Wallet</label>
          {wallet ? (
            <div className="flex items-center justify-between gap-2 bg-slate-900 rounded-lg px-4 py-3">
              <span className="font-mono text-sm text-emerald-400 truncate" title={wallet}>{wallet}</span>
              <span className="text-emerald-400 text-lg shrink-0">✓</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="w-full bg-slate-900 hover:bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {connecting ? 'Connecting…' : 'Connect Nimiq Wallet'}
            </button>
          )}
          <p className="text-[11px] text-slate-400 mt-1">
            Your wallet signs to prove ownership — only it can edit this profile later.
          </p>
        </div>

        {/* Optional details toggle */}
        <button
          type="button"
          onClick={() => setShowDetails(v => !v)}
          className="text-xs text-slate-400 hover:text-amber-300 underline underline-offset-4 transition-colors"
        >
          {showDetails ? '− Hide optional details' : '+ Add details (optional)'}
        </button>

        {showDetails && (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Display Name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your Name" className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Content URL</label>
              <input value={contentUrl} onChange={e => setContentUrl(e.target.value)} placeholder="https://x.com/yourthread" className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Goal (NIM) <span className="text-slate-500">· optional</span></label>
                <input type="number" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} placeholder="1000" className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Goal Label <span className="text-slate-500">· optional</span></label>
                <input value={goalLabel} onChange={e => setGoalLabel(e.target.value)} placeholder="e.g. New microphone" className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">What are you currently working on?</label>
              <input
                value={achievement}
                onChange={e => setAchievement(e.target.value)}
                placeholder={PLACEHOLDER_TEXT}
                maxLength={80}
                className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white text-sm"
              />
            </div>
          </>
        )}

        {error && <div className="text-red-400 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={submitting || !wallet || handleStatus === 'taken'}
          className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-slate-900 font-bold py-3 rounded-full"
        >
          {submitting ? 'Sign in wallet…' : 'Create TipWall'}
        </button>

        <p className="text-center text-xs text-slate-400">
          <Link href="/explore" className="underline underline-offset-4 hover:text-amber-300 transition-colors">
            Explore creator walls →
          </Link>
        </p>

        <p className="text-center text-[11px] text-slate-500">
          <Link href="/privacy" className="hover:text-amber-300 transition-colors">Privacy</Link>
          {' · '}
          <Link href="/terms" className="hover:text-amber-300 transition-colors">Terms</Link>
        </p>
      </form>
    </div>
  )
}
