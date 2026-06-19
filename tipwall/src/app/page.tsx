'use client'
import { useState, useEffect } from 'react'
import { signMessage } from '@/lib/nimiq'
import { useNimiqPay } from '@/hooks/useNimiqPay'
import InstallNimiqPrompt from '@/components/InstallNimiqPrompt'

export default function CreatorSetup() {
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [contentUrl, setContentUrl] = useState('')
  const [goalLabel, setGoalLabel] = useState('Goal')
  const [goalTarget, setGoalTarget] = useState('1000')
  const [achievement, setAchievement] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [placeholderText, setPlaceholderText] = useState('')
  const [showInstall, setShowInstall] = useState(false)
  const { isNimiqPay } = useNimiqPay()

  const achievementExamples = [
    'Building an AI agent',
    'Writing a Bitcoin guide',
    'Funding my next hackathon',
    'Open sourcing my CLI tool',
  ]

  useEffect(() => {
    const randomExample = achievementExamples[Math.floor(Math.random() * achievementExamples.length)]
    setPlaceholderText(`e.g. "${randomExample}"`)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      if (!isNimiqPay) {
        setShowInstall(true)
        setSubmitting(false)
        return
      }

      const displayNameVal = displayName || handle

      const chRes = await fetch('/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, action: 'create' }),
      })
      const ch = await chRes.json()
      if (!chRes.ok) throw new Error(ch.error || 'Could not start signing')

      const { publicKey, signature, address } = await signMessage(ch.message)

      const res = await fetch('/api/profile/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          walletAddress: address,
          displayName: displayNameVal,
          bio,
          contentUrl,
          goal: { label: goalLabel, targetNIM: parseInt(goalTarget) || 1000 },
          achievement: achievement || undefined,
          signature: { publicKey, signature, nonce: ch.nonce },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = `/${data.handle}`
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white flex items-center justify-center p-4">
      {showInstall && (
        <InstallNimiqPrompt
          url={typeof window !== 'undefined' ? window.location.origin : ''}
          onDismiss={() => setShowInstall(false)}
        />
      )}
      <form onSubmit={submit} className="w-full max-w-md bg-slate-800 rounded-2xl p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center">Create Your TipWall</h1>

        {!isNimiqPay && (
          <div className="p-3 bg-amber-400/10 border border-amber-400/30 rounded-xl text-sm text-amber-200 flex items-center gap-2">
            <span>⚠️</span>
            <span>Open in Nimiq Pay to create and manage your TipWall.</span>
            <button
              type="button"
              onClick={() => setShowInstall(true)}
              className="ml-auto text-xs bg-amber-400 text-slate-900 px-3 py-1 rounded-lg font-semibold"
            >
              Open →
            </button>
          </div>
        )}

        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Handle <span className="text-slate-500">(your unique URL)</span>
          </label>
          <input value={handle} onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} placeholder="yourname" className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white" required />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Display Name <span className="text-slate-500">(optional)</span>
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
            placeholder={placeholderText}
            maxLength={80}
            className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white text-sm"
          />
        </div>
        <p className="text-xs text-slate-400">
          Sign a message with your Nimiq wallet to prove ownership. The wallet you sign with becomes your tip payout address.
        </p>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button type="submit" disabled={submitting} className="w-full bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold py-3 rounded-full disabled:opacity-60">
          {submitting ? 'Waiting for signature…' : 'Sign & Create TipWall'}
        </button>
      </form>
    </div>
  )
}
