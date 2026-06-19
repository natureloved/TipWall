'use client'
import { useState, useEffect } from 'react'
import { initNimiq, signMessage } from '@/lib/nimiq'
import { useNimiqPay } from '@/hooks/useNimiqPay'
import InstallNimiqPrompt from '@/components/InstallNimiqPrompt'

export default function Dashboard() {
  const [connected, setConnected] = useState(false)
  const [wallet, setWallet] = useState('')
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [editValues, setEditValues] = useState({
    bio: '',
    achievement: '',
    goalLabel: 'Goal',
    goalTarget: '1000',
    contentUrl: '',
  })
  const [showInstall, setShowInstall] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const { isNimiqPay } = useNimiqPay()

  useEffect(() => {
    const checkConnection = async () => {
      if (!isNimiqPay) {
        setLoading(false)
        return
      }
      const result = await initNimiq()
      if (result.senderAddress) {
        setConnected(true)
        setWallet(result.senderAddress)
        const res = await fetch(`/api/profile/${result.senderAddress}`)
        if (res.ok) {
          const data = await res.json()
          if (data) {
            setProfile(data)
            setHandle(data.handle)
            setEditValues({
              bio: data.bio || '',
              achievement: data.achievement || '',
              goalLabel: data.goal?.label || 'Goal',
              goalTarget: String(data.goal?.targetNIM || 1000),
              contentUrl: data.contentUrl || '',
            })
          }
        }
      }
      setLoading(false)
    }
    checkConnection()
  }, [isNimiqPay])

  const startEdit = async () => {
    if (!isNimiqPay) {
      setShowInstall(true)
      return
    }
    if (!profile) return
    try {
      const res = await fetch('/api/dashboard/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const { publicKey, signature } = await signMessage(data.message)
      const verifyRes = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, publicKey, nonce: data.nonce }),
      })
      if (!verifyRes.ok) throw new Error((await verifyRes.json()).error)
      setShowEditForm(true)
      setError('')
    } catch (e: any) {
      setError(e.message || 'Signature verification failed')
    }
  }

  const saveProfile = async () => {
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          updates: {
            bio: editValues.bio,
            achievement: editValues.achievement,
            goal: { label: editValues.goalLabel, targetNIM: parseInt(editValues.goalTarget) },
            contentUrl: editValues.contentUrl,
          },
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setShowEditForm(false)
      const updated = await fetch(`/api/profile/${handle}`).then(r => r.json())
      setProfile(updated)
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading...</div>

  if (!isNimiqPay) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <InstallNimiqPrompt url={typeof window !== 'undefined' ? window.location.origin : ''} />
      </div>
    )
  }

  if (!connected) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">No Wallet Connected</h1>
        <p>Connect your Nimiq wallet in Nimiq Pay to access your dashboard</p>
        <p className="text-sm text-gray-400">Make sure you&apos;re viewing this inside the Nimiq Pay app</p>
        {error && <div className="text-red-400 text-sm">{error}</div>}
      </div>
    </div>
  )

  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">No TipWall Found</h1>
        <p className="text-gray-300">No profile found for wallet {wallet.slice(0, 6)}...{wallet.slice(-4)}</p>
        <a href="/" className="text-amber-400 underline">Create one instead</a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center">Your Dashboard</h1>
        <div className="rounded-2xl bg-white text-slate-900 p-6 shadow-lg">
          <p className="text-sm text-gray-500 mb-1">Your TipWall</p>
          <p className="text-xl font-bold text-amber-600">@{handle}</p>
          <p className="text-xs text-gray-500 mt-1">Share: /{handle}</p>
        </div>

        {showEditForm ? (
          <div className="rounded-2xl bg-white text-slate-900 p-6 shadow-lg space-y-4">
            <h2 className="font-bold text-lg">Edit Profile</h2>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Bio</label>
              <textarea value={editValues.bio} onChange={e => setEditValues(v => ({...v, bio: e.target.value}))} className="w-full bg-slate-100 rounded-lg p-3" rows={2} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">What are you working on?</label>
              <input value={editValues.achievement} onChange={e => setEditValues(v => ({...v, achievement: e.target.value}))} className="w-full bg-slate-100 rounded-lg p-3" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Goal Target (NIM)</label>
                <input type="number" value={editValues.goalTarget} onChange={e => setEditValues(v => ({...v, goalTarget: e.target.value}))} className="w-full bg-slate-100 rounded-lg p-3" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Goal Label</label>
                <input value={editValues.goalLabel} onChange={e => setEditValues(v => ({...v, goalLabel: e.target.value}))} className="w-full bg-slate-100 rounded-lg p-3" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Content URL</label>
              <input value={editValues.contentUrl} onChange={e => setEditValues(v => ({...v, contentUrl: e.target.value}))} className="w-full bg-slate-100 rounded-lg p-3" />
            </div>
            <div className="flex gap-3">
              <button onClick={saveProfile} className="bg-amber-400 text-slate-900 font-bold py-2 px-4 rounded-lg">Save</button>
              <button onClick={() => setShowEditForm(false)} className="border border-gray-300 text-gray-600 py-2 px-4 rounded-lg">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white text-slate-900 p-6 shadow-lg space-y-4">
            <h2 className="font-bold text-lg">Profile Details</h2>
            {profile.bio && <p>{profile.bio}</p>}
            {profile.achievement && <p className="text-amber-600 font-semibold">{profile.achievement}</p>}
            <button onClick={startEdit} className="border border-amber-400 text-amber-600 py-2 px-4 rounded-lg">Edit Profile</button>
          </div>
        )}

        {error && <div className="text-red-400 bg-red-400/10 p-3 rounded-lg">{error}</div>}
      </div>
    </div>
  )
}
