'use client'
import { useState } from 'react'
import { connectWallet, signProfileAuth } from '@/lib/nimiq'
import { normalizeHandle } from '@/lib/profile-auth'

const PLACEHOLDER_TEXT = 'e.g. "Building an AI agent"'

export default function CreatorSetup() {
  const [handle, setHandle] = useState('')
  const [wallet, setWallet] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [contentUrl, setContentUrl] = useState('')
  const [goalLabel, setGoalLabel] = useState('Goal')
  const [goalTarget, setGoalTarget] = useState('1000')
  const [achievement, setAchievement] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    // Connecting only lists accounts — no signature yet. The wallet is asked to
    // sign exactly once, on submit, so users don't face two prompts in a row.
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
    if (handleStr.length < 3) {
      setError('Handle must be at least 3 characters')
      return
    }
    if (!wallet) {
      setError('Connect your Nimiq wallet first')
      return
    }

    setSubmitting(true)
    try {
      const auth = await signProfileAuth({ action: 'create', handle: handleStr, walletAddress: wallet })

      const displayNameVal = displayName || handleStr
      const res = await fetch('/api/profile/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: handleStr,
          walletAddress: wallet,
          displayName: displayNameVal,
          bio,
          contentUrl,
          goal: { label: goalLabel, targetNIM: parseInt(goalTarget) || 1000 },
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
          } catch {
            // fall through to show the original error
          }
        }
        throw new Error(data.error)
      }
      window.location.href = `/${data.handle}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-slate-800 rounded-2xl p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center">Create Your TipWall</h1>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Handle <span className="text-slate-500">(your unique URL: tipwall.vercel.app/yourname)</span>
          </label>
          <input value={handle} onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} placeholder="yourname" className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white" required />
        </div>
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
          <p className="text-[11px] text-slate-500 mt-1">
            Your wallet signs to prove ownership — only it can edit this profile later.
          </p>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Display Name <span className="text-slate-500">(optional, defaults to handle)</span>
          </label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your Name" className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Bio</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Content URL (optional)</label>
          <input value={contentUrl} onChange={e => setContentUrl(e.target.value)} placeholder="https://x.com/yourthread" className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Goal (NIM)</label>
            <input type="number" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Goal Label</label>
            <input value={goalLabel} onChange={e => setGoalLabel(e.target.value)} placeholder="Next article" className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            What are you currently working on? <span className="text-slate-500">(optional)</span>
          </label>
          <input
            value={achievement}
            onChange={e => setAchievement(e.target.value)}
            placeholder={PLACEHOLDER_TEXT}
            maxLength={80}
            className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white text-sm"
          />
        </div>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button type="submit" disabled={submitting || !wallet} className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-slate-900 font-bold py-3 rounded-full">
          {submitting ? 'Sign in wallet…' : 'Create TipWall'}
        </button>
      </form>
    </div>
  )
}
