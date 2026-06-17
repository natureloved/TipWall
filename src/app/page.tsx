'use client'
import { useState, useEffect } from 'react'

export default function CreatorSetup() {
  const [handle, setHandle] = useState('')
  const [wallet, setWallet] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [contentUrl, setContentUrl] = useState('')
  const [goalLabel, setGoalLabel] = useState('Goal')
  const [goalTarget, setGoalTarget] = useState('1000')
  const [achievement, setAchievement] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [placeholderText, setPlaceholderText] = useState('')

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
      const res = await fetch('/api/profile/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          walletAddress: wallet,
          displayName,
          bio,
          contentUrl,
          goal: { label: goalLabel, targetNIM: parseInt(goalTarget) || 1000 },
          achievement: achievement || undefined,
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
      <form onSubmit={submit} className="w-full max-w-md bg-slate-800 rounded-2xl p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center">Create Your TipWall</h1>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Handle</label>
          <input value={handle} onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} placeholder="yourname" className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white" required />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Nimiq Wallet Address (NQ...)</label>
          <input value={wallet} onChange={e => setWallet(e.target.value)} placeholder="NQ..." className="w-full bg-slate-900 rounded-lg px-4 py-3 text-white font-mono text-sm" required />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Display Name</label>
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
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button type="submit" disabled={submitting} className="w-full bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold py-3 rounded-full">
          {submitting ? 'Creating...' : 'Create TipWall'}
        </button>
      </form>
    </div>
  )
}
