'use client'
import { useState } from 'react'
import { CreatorProfile } from '@/lib/types'
import { signProfileAuth } from '@/lib/nimiq'

interface Props {
  profile: CreatorProfile
  walletAddress: string
}

export default function DashboardEditProfile({ profile, walletAddress }: Props) {
  const [bio, setBio] = useState(profile.bio)
  const [contentUrl, setContentUrl] = useState(profile.contentUrl)
  const [achievement, setAchievement] = useState(profile.achievement || '')
  const [goalLabel, setGoalLabel] = useState(profile.goal?.label || '')
  const [goalTarget, setGoalTarget] = useState(profile.goal?.targetNIM?.toString() || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      // Signature-bound edit: prove wallet ownership for this change, same as
      // the public edit page. The server verifies the signature — the wallet
      // address alone is not sufficient authorization.
      const auth = await signProfileAuth({ action: 'update', handle: profile.handle, walletAddress })
      const res = await fetch(`/api/profile/${profile.handle}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio,
          contentUrl,
          achievement: achievement || undefined,
          goal: goalLabel && goalTarget ? { label: goalLabel, targetNIM: Number(goalTarget) } : undefined,
          auth,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save changes')
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-t border-gray-100 pt-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Edit your wall</p>

      <label className="text-xs text-gray-500 mb-1 block">Bio</label>
      <textarea
        value={bio}
        onChange={e => setBio(e.target.value)}
        maxLength={160}
        rows={2}
        className="w-full border border-gray-200 rounded-lg p-3 text-sm mb-3 resize-none"
      />

      <label className="text-xs text-gray-500 mb-1 block">Content link</label>
      <input
        value={contentUrl}
        onChange={e => setContentUrl(e.target.value)}
        className="w-full border border-gray-200 rounded-lg p-3 text-sm mb-3"
      />

      <label className="text-xs text-gray-500 mb-1 block">Currently working on</label>
      <input
        value={achievement}
        onChange={e => setAchievement(e.target.value)}
        className="w-full border border-gray-200 rounded-lg p-3 text-sm mb-3"
      />

      <label className="text-xs text-gray-500 mb-1 block">Goal label</label>
      <input
        value={goalLabel}
        onChange={e => setGoalLabel(e.target.value)}
        className="w-full border border-gray-200 rounded-lg p-2 text-sm mb-2"
      />

      <label className="text-xs text-gray-500 mb-1 block">Goal target (NIM)</label>
      <input
        value={goalTarget}
        onChange={e => setGoalTarget(e.target.value)}
        type="number"
        className="w-full border border-gray-200 rounded-lg p-2 text-sm mb-3"
      />

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-[#F6B221] text-[#412402] font-medium rounded-lg text-sm disabled:opacity-50"
      >
        {saving ? 'Sign in wallet…' : saved ? '✓ Saved' : 'Save changes'}
      </button>
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  )
}