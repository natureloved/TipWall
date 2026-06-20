'use client'
import { useState } from 'react'
import { type CreatorProfile } from '@/lib/types'
import { connectWallet, signProfileAuth } from '@/lib/nimiq'
import { normalizeAddress } from '@/lib/profile-auth'

export default function EditProfileClient({ handle, profile }: { handle: string; profile: CreatorProfile }) {
  const [wallet, setWallet] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [displayName, setDisplayName] = useState(profile.displayName || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [contentUrl, setContentUrl] = useState(profile.contentUrl || '')
  const [goalLabel, setGoalLabel] = useState(profile.goal?.label || 'Goal')
  const [goalTarget, setGoalTarget] = useState(String(profile.goal?.targetNIM ?? 1000))
  const [achievement, setAchievement] = useState(profile.achievement || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const isOwner = !!wallet && normalizeAddress(wallet) === normalizeAddress(profile.walletAddress)

  const handleConnect = async () => {
    setError(null)
    setConnecting(true)
    try {
      const address = await connectWallet()
      setWallet(address)
      if (normalizeAddress(address) !== normalizeAddress(profile.walletAddress)) {
        setError('This wallet does not own @' + handle + '. Connect the wallet used to create it.')
      }
    } catch (err: any) {
      setError(err.message || 'Could not connect wallet')
    } finally {
      setConnecting(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    if (!isOwner) {
      setError('Connect the owner wallet to edit this profile.')
      return
    }
    setSubmitting(true)
    try {
      // Signature-bound edit: re-prove ownership for every change.
      const auth = await signProfileAuth({ action: 'update', handle, walletAddress: wallet })
      const res = await fetch(`/api/profile/${handle}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          bio,
          contentUrl,
          goal: { label: goalLabel, targetNIM: parseInt(goalTarget) || 1000 },
          achievement: achievement || undefined,
          auth,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSaved(true)
      setTimeout(() => { window.location.href = `/${handle}` }, 800)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Edit @{handle}</h1>
          <a href={`/${handle}`} className="text-xs text-slate-400 hover:text-white underline">View wall</a>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Owner wallet</label>
          {wallet ? (
            <div className={`flex items-center justify-between gap-2 rounded-lg px-4 py-3 ${isOwner ? 'bg-slate-900' : 'bg-red-950/50 border border-red-500/40'}`}>
              <span className={`font-mono text-sm truncate ${isOwner ? 'text-emerald-400' : 'text-red-300'}`} title={wallet}>{wallet}</span>
              <span className="text-lg shrink-0">{isOwner ? '✓' : '✗'}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="w-full bg-slate-900 hover:bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {connecting ? 'Connecting…' : 'Connect Owner Wallet'}
            </button>
          )}
        </div>

        <fieldset disabled={!isOwner} className="space-y-4 disabled:opacity-50">
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
              <label className="block text-xs text-slate-400 mb-1">Goal (NIM)</label>
              <input type="number" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Goal Label</label>
              <input value={goalLabel} onChange={e => setGoalLabel(e.target.value)} placeholder="Next article" className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">What are you currently working on?</label>
            <input value={achievement} onChange={e => setAchievement(e.target.value)} maxLength={80} className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white text-sm" />
          </div>
        </fieldset>

        {error && <div className="text-red-400 text-sm">{error}</div>}
        {saved && <div className="text-emerald-400 text-sm">Saved! Redirecting…</div>}
        <button type="submit" disabled={submitting || !isOwner} className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-slate-900 font-bold py-3 rounded-full">
          {submitting ? 'Sign in wallet…' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
