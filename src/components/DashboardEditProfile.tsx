'use client'
import { useState } from 'react'
import { CreatorProfile, type SocialLinks } from '@/lib/types'
import { connectWallet, signProfileAuth } from '@/lib/nimiq'
import { normalizeAddress, nimiqAddressError } from '@/lib/profile-auth'
import { useTranslations } from '@/lib/i18n'

interface Props {
  profile: CreatorProfile
  walletAddress: string
}

const fieldClassName = 'w-full rounded-lg border border-[#92897b] bg-[#fffdf7] p-3 text-sm text-[#171614] placeholder:text-[#746b5e] transition-[border-color,box-shadow] focus:border-[#b9382a] focus:outline-none focus:ring-2 focus:ring-[#f05a3c]/25'

export default function DashboardEditProfile({ profile, walletAddress }: Props) {
  const t = useTranslations()
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [bio, setBio] = useState(profile.bio)
  const [contentUrl, setContentUrl] = useState(profile.contentUrl)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '')
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(profile.socialLinks || {})
  const [achievement, setAchievement] = useState(profile.achievement || '')
  const [goalLabel, setGoalLabel] = useState(profile.goal?.label || '')
  const [goalTarget, setGoalTarget] = useState(profile.goal?.targetNIM?.toString() || '')
  const [recoveryWalletAddress, setRecoveryWalletAddress] = useState(profile.recoveryWalletAddress || '')
  const [usdtPolygonAddress, setUsdtPolygonAddress] = useState(profile.usdtPolygonAddress || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newWallet, setNewWallet] = useState('')
  const [currentTransferAuth, setCurrentTransferAuth] = useState<Awaited<ReturnType<typeof signProfileAuth>> | null>(null)
  const [transferBusy, setTransferBusy] = useState(false)
  const [transferMessage, setTransferMessage] = useState('')

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
          displayName,
          bio,
          contentUrl,
          avatarUrl: avatarUrl.trim() || '',
          socialLinks,
          achievement: achievement || undefined,
          goal: goalLabel && goalTarget ? { label: goalLabel, targetNIM: Number(goalTarget) } : undefined,
          recoveryWalletAddress: recoveryWalletAddress.trim() || '',
          usdtPolygonAddress: usdtPolygonAddress.trim() || '',
          auth,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('editSaveError'))
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('editSaveError'))
    } finally {
      setSaving(false)
    }
  }

  async function prepareCurrentTransfer() {
    const target = normalizeAddress(newWallet)
    const targetError = nimiqAddressError(target)
    if (targetError) return setTransferMessage(targetError)
    if (target === normalizeAddress(walletAddress)) return setTransferMessage(t('editChooseDifferentWallet'))
    setTransferBusy(true)
    setTransferMessage('')
    try {
      const auth = await signProfileAuth({ action: 'transfer', handle: profile.handle, walletAddress, transferTo: target })
      setCurrentTransferAuth(auth)
      setTransferMessage(t('editOwnerApproved'))
    } catch (err) {
      setTransferMessage(err instanceof Error ? err.message : t('editSignTransferError'))
    } finally {
      setTransferBusy(false)
    }
  }

  async function completeTransfer() {
    if (!currentTransferAuth) return
    setTransferBusy(true)
    setTransferMessage('')
    try {
      const target = normalizeAddress(newWallet)
      const connected = normalizeAddress(await connectWallet())
      if (connected !== target) throw new Error('Connect the destination wallet before signing.')
      const newOwnerAuth = await signProfileAuth({ action: 'transfer', handle: profile.handle, walletAddress: connected, transferTo: target })
      const res = await fetch(`/api/profile/${profile.handle}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newWalletAddress: target, auth: currentTransferAuth, newOwnerAuth }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('editTransferError'))
      setCurrentTransferAuth(null)
      setNewWallet('')
      setTransferMessage(t('editTransferred'))
    } catch (err) {
      setTransferMessage(err instanceof Error ? err.message : t('editTransferError'))
    } finally {
      setTransferBusy(false)
    }
  }

  return (
    <section className="border-t border-[#171614]/20 pt-5" aria-labelledby="dashboard-edit-heading">
      <h2 id="dashboard-edit-heading" className="mb-3 text-xs font-bold uppercase tracking-wide text-[#5f574b]">
        {t('editHeading')}
      </h2>

      <label htmlFor="dashboard-display-name" className="mb-1 block text-xs font-medium text-[#5f574b]">{t('editDisplayName')}</label>
      <input
        id="dashboard-display-name"
        value={displayName}
        onChange={event => setDisplayName(event.target.value)}
        maxLength={50}
        className={`${fieldClassName} mb-3`}
      />

      <label htmlFor="dashboard-avatar-url" className="mb-1 block text-xs font-medium text-[#5f574b]">{t('editAvatarUrl')}</label>
      <input
        id="dashboard-avatar-url"
        value={avatarUrl}
        onChange={event => setAvatarUrl(event.target.value)}
        placeholder={t('editAvatarUrlPlaceholder')}
        inputMode="url"
        className={`${fieldClassName} mb-3`}
      />

      <label htmlFor="dashboard-bio" className="mb-1 block text-xs font-medium text-[#5f574b]">{t('editBio')}</label>
      <textarea
        id="dashboard-bio"
        value={bio}
        onChange={event => setBio(event.target.value)}
        maxLength={160}
        rows={2}
        className={`${fieldClassName} mb-3 resize-none`}
      />

      <label htmlFor="dashboard-content-link" className="mb-1 block text-xs font-medium text-[#5f574b]">{t('editContentLink')}</label>
      <input
        id="dashboard-content-link"
        value={contentUrl}
        onChange={event => setContentUrl(event.target.value)}
        className={`${fieldClassName} mb-3`}
      />

      <fieldset className="mb-3">
        <legend className="mb-1 block text-xs font-medium text-[#5f574b]">{t('editSocialLinks')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={socialLinks.website || ''}
            onChange={event => setSocialLinks(current => ({ ...current, website: event.target.value }))}
            placeholder={t('editWebsite')}
            aria-label={t('editWebsite')}
            inputMode="url"
            className={fieldClassName}
          />
          {(['x', 'github', 'telegram'] as const).map(key => (
            <input
              key={key}
              value={socialLinks[key] || ''}
              onChange={event => setSocialLinks(current => ({ ...current, [key]: event.target.value }))}
              placeholder={`${key[0].toUpperCase()}${key.slice(1)} URL`}
              aria-label={`${key} URL`}
              inputMode="url"
              className={fieldClassName}
            />
          ))}
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[#746b5e]">{t('editSocialLinksHelp')}</p>
      </fieldset>

      <label htmlFor="dashboard-achievement" className="mb-1 block text-xs font-medium text-[#5f574b]">{t('editWorkingOn')}</label>
      <input
        id="dashboard-achievement"
        value={achievement}
        onChange={event => setAchievement(event.target.value)}
        className={`${fieldClassName} mb-3`}
      />

      <label htmlFor="dashboard-goal-label" className="mb-1 block text-xs font-medium text-[#5f574b]">{t('editGoalLabel')}</label>
      <input
        id="dashboard-goal-label"
        value={goalLabel}
        onChange={event => setGoalLabel(event.target.value)}
        className={`${fieldClassName} mb-3`}
      />

      <label htmlFor="dashboard-goal-target" className="mb-1 block text-xs font-medium text-[#5f574b]">{t('editGoalTarget')}</label>
      <input
        id="dashboard-goal-target"
        value={goalTarget}
        onChange={event => setGoalTarget(event.target.value)}
        type="number"
        className={`${fieldClassName} mb-3`}
      />

      <label htmlFor="dashboard-recovery-wallet" className="mb-1 block text-xs font-medium text-[#5f574b]">{t('recoveryWalletLabel')}</label>
      <input
        id="dashboard-recovery-wallet"
        value={recoveryWalletAddress}
        onChange={event => setRecoveryWalletAddress(event.target.value)}
        placeholder={t('recoveryWalletPlaceholder')}
        className={`${fieldClassName} mb-1`}
      />
      <p className="mb-3 text-[11px] leading-relaxed text-[#746b5e]">{t('recoveryWalletHelp')}</p>

      <label htmlFor="dashboard-usdt-wallet" className="mb-1 block text-xs font-medium text-[#5f574b]">{t('usdtWalletLabel')}</label>
      <input
        id="dashboard-usdt-wallet"
        value={usdtPolygonAddress}
        onChange={event => setUsdtPolygonAddress(event.target.value)}
        placeholder={t('usdtWalletPlaceholder')}
        className={`${fieldClassName} mb-1`}
      />
      <p className="mb-3 text-[11px] leading-relaxed text-[#746b5e]">{t('usdtWalletHelp')}</p>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg border border-[#171614] bg-[#f05a3c] py-3 text-sm font-bold text-[#171614] shadow-[3px_3px_0_#171614] transition-[transform,box-shadow,background-color] hover:-translate-y-0.5 hover:bg-[#e85236] hover:shadow-[4px_4px_0_#171614] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9382a] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_#171614]"
      >
        {saving ? t('editSaving') : saved ? t('editSaved') : t('editSave')}
      </button>
      {error && <p className="mt-2 text-xs font-medium text-[#9d2c21]" role="alert">{error}</p>}

      <div className="mt-6 border-t border-[#171614]/15 pt-5" aria-labelledby="wallet-recovery-heading">
        <h3 id="wallet-recovery-heading" className="mb-1 text-xs font-bold uppercase tracking-wide text-[#5f574b]">{t('recoveryTitle')}</h3>
        <p className="mb-3 text-xs leading-relaxed text-[#746b5e]">{t('recoveryBody')}</p>
        <input
          value={newWallet}
          onChange={event => { setNewWallet(event.target.value); setCurrentTransferAuth(null); setTransferMessage('') }}
          placeholder={t('recoveryDestination')}
          aria-label={t('recoveryDestination')}
          className={`${fieldClassName} mb-2`}
        />
        {!currentTransferAuth ? (
          <button onClick={prepareCurrentTransfer} disabled={transferBusy || !newWallet.trim()} className="w-full rounded-lg border border-[#171614]/40 bg-[#fffdf7] py-2.5 text-xs font-bold text-[#171614] transition-colors hover:border-[#b9382a] hover:text-[#b9382a] disabled:cursor-not-allowed disabled:opacity-50">
            {transferBusy ? t('recoveryWaiting') : t('recoveryApprove')}
          </button>
        ) : (
          <button onClick={completeTransfer} disabled={transferBusy} className="w-full rounded-lg border border-[#171614] bg-[#171614] py-2.5 text-xs font-bold text-[#fffdf7] transition-colors hover:bg-[#b9382a] disabled:cursor-not-allowed disabled:opacity-50">
            {transferBusy ? t('recoverySigningDestination') : t('recoverySignDestination')}
          </button>
        )}
        {transferMessage && <p className="mt-2 text-xs font-medium text-[#5f574b]" role="status">{transferMessage}</p>}
      </div>
    </section>
  )
}
