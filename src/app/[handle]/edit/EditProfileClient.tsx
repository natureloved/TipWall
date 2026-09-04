'use client'
import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { type CreatorProfile, type WallTheme, type CreatorCategory, CREATOR_CATEGORIES } from '@/lib/types'
import { VALID_THEMES, VALID_CATEGORIES } from '@/lib/validate-profile'
import { connectWallet, signProfileAuth } from '@/lib/nimiq'
import { normalizeAddress } from '@/lib/profile-auth'
import { detectNimiqPay, buildNimiqPayDeepLink, wallUrl, isMobileDevice } from '@/lib/environment'
import { useTranslations } from '@/lib/i18n'

const fieldClass = 'w-full rounded-lg border border-[#92897b] bg-[#fffdf7] px-4 py-3 text-[#171614] placeholder:text-[#746b5e] transition-colors hover:border-[#746b5e] focus:border-[#f05a3c] focus:outline-none focus:ring-2 focus:ring-[#f05a3c]/20 disabled:cursor-not-allowed'
const labelClass = 'mb-1 block text-xs font-semibold text-[#5f574b]'

const THEME_SWATCHES: { id: WallTheme; label: string; paper: string; accent: string }[] = [
  { id: 'paper', label: 'Paper', paper: '#f4f0e6', accent: '#f05a3c' },
  { id: 'mint', label: 'Mint', paper: '#eef3ea', accent: '#4c8f63' },
  { id: 'blush', label: 'Blush', paper: '#f8eeee', accent: '#e0708f' },
  { id: 'sky', label: 'Sky', paper: '#edf2f5', accent: '#4a89a0' },
  { id: 'sun', label: 'Sun', paper: '#f8ecd7', accent: '#e0862f' },
]

export default function EditProfileClient({ handle, profile }: { handle: string; profile: CreatorProfile }) {
  const t = useTranslations()
  const [wallet, setWallet] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [displayName, setDisplayName] = useState(profile.displayName || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [contentUrl, setContentUrl] = useState(profile.contentUrl || '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '')
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(profile.socialLinks || {})
  const [goalLabel, setGoalLabel] = useState(profile.goal?.label || 'Goal')
  const [goalTarget, setGoalTarget] = useState(String(profile.goal?.targetNIM ?? 1000))
  const [achievement, setAchievement] = useState(profile.achievement || '')
  const [theme, setTheme] = useState<WallTheme>(profile.theme && VALID_THEMES.has(profile.theme) ? profile.theme : 'paper')
  const [category, setCategory] = useState<CreatorCategory | ''>(profile.category && VALID_CATEGORIES.has(profile.category) ? profile.category : '')
  const [notifyTelegram, setNotifyTelegram] = useState(profile.notifyTelegram || '')
  const [usdtPolygonAddress, setUsdtPolygonAddress] = useState(profile.usdtPolygonAddress || '')
  const [notifyClear, setNotifyClear] = useState(false)
  const [tagsInput, setTagsInput] = useState((profile.tags || []).join(', '))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Editing needs a wallet signature, which only exists inside Nimiq Pay. On
  // desktop we swap the dead "Connect" button for a handoff into the app.
  const [inNimiqPay, setInNimiqPay] = useState<boolean | null>(null)
  const [handoffQr, setHandoffQr] = useState('')
  const editDeepLink = buildNimiqPayDeepLink(`${wallUrl(handle)}/edit`)

  useEffect(() => { detectNimiqPay().then(setInNimiqPay) }, [])

  useEffect(() => {
    if (inNimiqPay !== false) return
    QRCode.toDataURL(editDeepLink, { width: 220, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setHandoffQr).catch(() => setHandoffQr(''))
  }, [inNimiqPay, editDeepLink])

  const isOwner = !!wallet && normalizeAddress(wallet) === normalizeAddress(profile.walletAddress)

  const handleConnect = async () => {
    setError(null)
    setConnecting(true)
    try {
      const address = await connectWallet()
      setWallet(address)
      if (normalizeAddress(address) !== normalizeAddress(profile.walletAddress)) {
        setError(t('editWalletMismatch', { handle }))
      }
    } catch (err) {
      const error = err as Error
      setError(error.message || t('editConnectError'))
    } finally {
      setConnecting(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    if (!isOwner) {
      setError(t('editOwnerRequired'))
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
          avatarUrl,
          socialLinks,
          goal: { label: goalLabel, targetNIM: parseInt(goalTarget) || 1000 },
          achievement: achievement || undefined,
          theme,
          category,
          notifyTelegram: notifyClear ? '' : notifyTelegram.trim() || undefined,
          usdtPolygonAddress: usdtPolygonAddress.trim() || '',
          tags: tagsInput.split(',').map(s => s.trim()).filter(Boolean),
          auth,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('editSaveError'))
      setSaved(true)
      setTimeout(() => { window.location.href = `/${handle}` }, 800)
    } catch (err) {
      const error = err as Error
      setError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!isOwner || deleteConfirm !== handle || deleting) return
    setError(null)
    setDeleting(true)
    try {
      // Deletion is irreversible, so it gets its own explicit `delete`
      // signature - a stale create/update/view proof can never be repurposed.
      const auth = await signProfileAuth({ action: 'delete', handle, walletAddress: wallet })
      const res = await fetch(`/api/profile/${handle}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('editDeleteError'))
      window.location.href = '/'
    } catch (err) {
      const error = err as Error
      setError(error.message || t('editDeleteError'))
      setDeleting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#f4f0e6] p-4 py-6 text-[#171614] sm:items-center sm:py-10">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border-2 border-[#171614] bg-[#fffaf0] p-4 shadow-[5px_5px_0_#171614] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-[#171614]">{t('editTitle', { handle })}</h1>
          <div className="flex gap-3">
            <a href={`/${handle}/recover`} className="rounded text-xs font-semibold text-[#5f574b] underline underline-offset-4 transition-colors hover:text-[#171614]">{t('editRecoverAccess')}</a>
            <a href={`/${handle}`} className="rounded text-xs font-semibold text-[#b9382a] underline underline-offset-4 transition-colors hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c]">{t('analViewWall')}</a>
          </div>
        </div>

        <div>
          <label className={labelClass}>{t('editOwnerWallet')}</label>
          {wallet ? (
            <div className={`flex items-center justify-between gap-2 rounded-lg border px-4 py-3 ${isOwner ? 'border-[#9ab6a2] bg-[#edf5ee]' : 'border-[#d36b61] bg-[#fff0ed]'}`}>
              <span className={`truncate font-mono text-sm font-semibold ${isOwner ? 'text-[#315c3e]' : 'text-[#8f2923]'}`} title={wallet}>{wallet}</span>
              <span className="text-lg shrink-0">{isOwner ? '✓' : '✗'}</span>
            </div>
          ) : inNimiqPay === false ? (
            <div className="space-y-3 rounded-xl border border-[#ef9b88] bg-[#fff0eb] p-4">
              <p className="text-sm leading-relaxed text-[#5f342d]">
                {t('editWalletRequired')}
              </p>
              {isMobileDevice() ? (
                <a
                  href={editDeepLink}
                  className="block min-h-12 w-full rounded-xl bg-[#171614] px-4 py-3 text-center font-bold text-[#fffdf7] shadow-[3px_3px_0_#f05a3c] transition-all hover:-translate-y-0.5 hover:bg-[#b9382a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff0eb]"
                >
                  {t('editOpenPay')}
                </a>
              ) : (
                <div className="space-y-2 text-center">
                  {handoffQr && (
                    // eslint-disable-next-line @next/next/no-img-element -- data: URL QR code; nothing to optimize
                    <img src={handoffQr} alt="Scan to open this editor in Nimiq Pay" className="mx-auto max-w-full rounded-lg border border-[#cfc2af] bg-white p-2" width={220} height={220} />
                  )}
                  <p className="text-xs text-[#5f574b]">
                    {t('editScanPay')}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting || inNimiqPay === null}
              className="min-h-12 w-full rounded-lg border border-[#171614] bg-[#171614] px-4 py-3 text-sm font-semibold text-[#fffdf7] transition-colors hover:bg-[#b9382a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {inNimiqPay === null ? t('editCheckingWallet') : connecting ? t('editConnecting') : t('editConnectOwner')}
            </button>
          )}
        </div>

        <fieldset disabled={!isOwner} className="space-y-4 disabled:opacity-60">
          <div>
            <label className={labelClass}>{t('editDisplayName')}</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={t('editDisplayNamePlaceholder')} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>{t('editBio')}</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>{t('editContentLink')}</label>
            <input value={contentUrl} onChange={e => setContentUrl(e.target.value)} placeholder={t('editContentLinkPlaceholder')} className={`${fieldClass} text-sm`} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t('editAvatarUrl')}</label>
              <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder={t('editAvatarUrlPlaceholder')} className={`${fieldClass} text-sm`} inputMode="url" />
            </div>
            <div>
              <label className={labelClass}>{t('editWebsite')}</label>
              <input value={socialLinks.website || ''} onChange={e => setSocialLinks(current => ({ ...current, website: e.target.value }))} placeholder="https://..." className={`${fieldClass} text-sm`} inputMode="url" />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t('editSocialLinks')}</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(['x', 'github', 'telegram'] as const).map(key => (
                <input key={key} value={socialLinks[key] || ''} onChange={e => setSocialLinks(current => ({ ...current, [key]: e.target.value }))} placeholder={key === 'x' ? 'X URL' : `${key[0].toUpperCase()}${key.slice(1)} URL`} className={`${fieldClass} text-sm`} inputMode="url" aria-label={`${key} URL`} />
              ))}
            </div>
            <p className="mt-1 text-[11px] text-[#746b5e]">{t('editSocialLinksHelp')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('editGoalTarget')}</label>
              <input type="number" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>{t('editGoalLabel')}</label>
              <input value={goalLabel} onChange={e => setGoalLabel(e.target.value)} placeholder={t('editGoalLabelPlaceholder')} className={fieldClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t('editWorkingOn')}</label>
            <input value={achievement} onChange={e => setAchievement(e.target.value)} maxLength={80} className={`${fieldClass} text-sm`} />
          </div>
          <div>
            <label className={labelClass}>{t('usdtWalletLabel')}</label>
            <input value={usdtPolygonAddress} onChange={e => setUsdtPolygonAddress(e.target.value)} placeholder={t('usdtWalletPlaceholder')} className={`${fieldClass} text-sm`} />
            <p className="mt-1 text-[11px] leading-relaxed text-[#746b5e]">{t('usdtWalletHelp')}</p>
          </div>
          <div>
            <label className={labelClass}>{t('editTelegram')}</label>
            <input
              value={notifyTelegram}
              onChange={e => setNotifyTelegram(e.target.value)}
              placeholder={t('editTelegramPlaceholder')}
              className={`${fieldClass} text-xs`}
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-[#5f574b]">
              <input type="checkbox" checked={notifyClear} onChange={e => setNotifyClear(e.target.checked)} className="h-3.5 w-3.5 accent-[#f05a3c]" />
              {t('editRemoveWebhook')}
            </label>
            <p className="mt-1 text-[11px] text-[#746b5e]">
              {t('editWebhookHelp')}
            </p>
          </div>
          <div>
            <label className={labelClass}>{t('editTags')}</label>
            <input
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder={t('editTagsPlaceholder')}
              className={`${fieldClass} text-sm`}
            />
            <p className="mt-1 text-[11px] text-[#746b5e]">{t('editTagsHelp')}</p>
          </div>
          <div>
            <label className={labelClass}>{t('editCategory')}</label>
            <select value={category} onChange={e => setCategory(e.target.value as CreatorCategory | '')} className={fieldClass}>
              <option value="">{t('editNoCategory')}</option>
              {(Object.keys(CREATOR_CATEGORIES) as CreatorCategory[]).map(c => (
                <option key={c} value={c}>{CREATOR_CATEGORIES[c].emoji} {t(`category_${c}`)}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[#746b5e]">{t('editCategoryHelp')}</p>
          </div>
          <div>
            <label className={labelClass}>{t('editTheme')}</label>
            <div className="flex flex-wrap gap-2">
              {THEME_SWATCHES.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setTheme(s.id)}
                  aria-pressed={theme === s.id}
                  title={t(`theme_${s.id}`)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${theme === s.id ? 'border-[#171614] shadow-[2px_2px_0_#171614]' : 'border-[#92897b] opacity-70 hover:opacity-100'}`}
                  style={{ background: s.paper, color: '#171614' }}
                >
                  <span className="h-3.5 w-3.5 rounded-full border border-[#171614]/40" style={{ background: s.accent }} aria-hidden />
                  {t(`theme_${s.id}`)}
                </button>
              ))}
            </div>
          </div>
        </fieldset>

        {error && <div className="rounded-xl border border-[#d36b61] bg-[#fff0ed] p-3 text-sm font-medium text-[#8f2923]" role="alert">{error}</div>}
        {saved && <div className="rounded-xl border border-[#9ab6a2] bg-[#edf5ee] p-3 text-sm font-medium text-[#315c3e]" role="status">{t('editSavedRedirect')}</div>}
        <button type="submit" disabled={submitting || !isOwner} className="min-h-12 w-full rounded-xl bg-[#171614] py-3 font-bold text-[#fffdf7] shadow-[3px_3px_0_#f05a3c] transition-all hover:-translate-y-0.5 hover:bg-[#b9382a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-[#171614]">
          {submitting ? t('editSaving') : t('editSave')}
        </button>

        {/* Danger zone: permanent wall deletion (owner wallet only) */}
        {isOwner && (
          <div className="mt-2 space-y-3 rounded-xl border border-[#c9463c] bg-[#fff0ed] p-4">
            <p className="text-sm font-bold text-[#8f2923]">{t('editDanger')}</p>
            <p className="text-xs leading-relaxed text-[#6f2824]">
              {t('editDeleteBody', { handle: `@${handle}` })}
            </p>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={t('editDeleteConfirm', { handle })}
              className="w-full rounded-lg border border-[#c9463c] bg-[#fffdf7] px-4 py-3 text-sm text-[#171614] placeholder:text-[#746b5e] focus:border-[#8f2923] focus:outline-none focus:ring-2 focus:ring-[#c9463c]/20"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteConfirm !== handle || deleting}
              className="min-h-12 w-full rounded-xl bg-[#8f2923] py-3 text-sm font-bold text-[#fffdf7] transition-colors hover:bg-[#6f1f1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f2923] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff0ed] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? t('editSaving') : t('editDeleteForever')}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
