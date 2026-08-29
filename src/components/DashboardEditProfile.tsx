'use client'
import { useState } from 'react'
import { CreatorProfile } from '@/lib/types'
import { signProfileAuth } from '@/lib/nimiq'

interface Props {
  profile: CreatorProfile
  walletAddress: string
}

const fieldClassName = 'w-full rounded-lg border border-[#92897b] bg-[#fffdf7] p-3 text-sm text-[#171614] placeholder:text-[#746b5e] transition-[border-color,box-shadow] focus:border-[#b9382a] focus:outline-none focus:ring-2 focus:ring-[#f05a3c]/25'

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
      // Prove wallet ownership for this change, matching the public edit page.
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
    <section className="border-t border-[#171614]/20 pt-5" aria-labelledby="dashboard-edit-heading">
      <h2 id="dashboard-edit-heading" className="mb-3 text-xs font-bold uppercase tracking-wide text-[#5f574b]">
        Edit your wall
      </h2>

      <label htmlFor="dashboard-bio" className="mb-1 block text-xs font-medium text-[#5f574b]">Bio</label>
      <textarea
        id="dashboard-bio"
        value={bio}
        onChange={event => setBio(event.target.value)}
        maxLength={160}
        rows={2}
        className={`${fieldClassName} mb-3 resize-none`}
      />

      <label htmlFor="dashboard-content-link" className="mb-1 block text-xs font-medium text-[#5f574b]">Content link</label>
      <input
        id="dashboard-content-link"
        value={contentUrl}
        onChange={event => setContentUrl(event.target.value)}
        className={`${fieldClassName} mb-3`}
      />

      <label htmlFor="dashboard-achievement" className="mb-1 block text-xs font-medium text-[#5f574b]">Currently working on</label>
      <input
        id="dashboard-achievement"
        value={achievement}
        onChange={event => setAchievement(event.target.value)}
        className={`${fieldClassName} mb-3`}
      />

      <label htmlFor="dashboard-goal-label" className="mb-1 block text-xs font-medium text-[#5f574b]">Goal label</label>
      <input
        id="dashboard-goal-label"
        value={goalLabel}
        onChange={event => setGoalLabel(event.target.value)}
        className={`${fieldClassName} mb-3`}
      />

      <label htmlFor="dashboard-goal-target" className="mb-1 block text-xs font-medium text-[#5f574b]">Goal target (NIM)</label>
      <input
        id="dashboard-goal-target"
        value={goalTarget}
        onChange={event => setGoalTarget(event.target.value)}
        type="number"
        className={`${fieldClassName} mb-3`}
      />

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg border border-[#171614] bg-[#f05a3c] py-3 text-sm font-bold text-[#171614] shadow-[3px_3px_0_#171614] transition-[transform,box-shadow,background-color] hover:-translate-y-0.5 hover:bg-[#e85236] hover:shadow-[4px_4px_0_#171614] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9382a] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_#171614]"
      >
        {saving ? 'Sign in wallet...' : saved ? 'Saved' : 'Save changes'}
      </button>
      {error && <p className="mt-2 text-xs font-medium text-[#9d2c21]" role="alert">{error}</p>}
    </section>
  )
}
