'use client'
import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { type CreatorProfile, type WallTheme, type CreatorCategory, CREATOR_CATEGORIES } from '@/lib/types'
import { VALID_THEMES, VALID_CATEGORIES } from '@/lib/validate-profile'
import { connectWallet, signProfileAuth } from '@/lib/nimiq'
import { normalizeAddress } from '@/lib/profile-auth'
import { detectNimiqPay, buildNimiqPayDeepLink, wallUrl, isMobileDevice } from '@/lib/environment'

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
  const [wallet, setWallet] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [displayName, setDisplayName] = useState(profile.displayName || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [contentUrl, setContentUrl] = useState(profile.contentUrl || '')
  const [goalLabel, setGoalLabel] = useState(profile.goal?.label || 'Goal')
  const [goalTarget, setGoalTarget] = useState(String(profile.goal?.targetNIM ?? 1000))
  const [achievement, setAchievement] = useState(profile.achievement || '')
  const [theme, setTheme] = useState<WallTheme>(profile.theme && VALID_THEMES.has(profile.theme) ? profile.theme : 'paper')
  const [category, setCategory] = useState<CreatorCategory | ''>(profile.category && VALID_CATEGORIES.has(profile.category) ? profile.category : '')
  const [notifyTelegram, setNotifyTelegram] = useState(profile.notifyTelegram || '')
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
        setError('This wallet does not own @' + handle + '. Connect the wallet used to create it.')
      }
    } catch (err) {
      const error = err as Error
      setError(error.message || 'Could not connect wallet')
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
          theme,
          category,
          notifyTelegram: notifyClear ? '' : notifyTelegram.trim() || undefined,
          tags: tagsInput.split(',').map(s => s.trim()).filter(Boolean),
          auth,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
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
      if (!res.ok) throw new Error(data.error || 'Failed to delete wall')
      window.location.href = '/'
    } catch (err) {
      const error = err as Error
      setError(error.message || 'Failed to delete wall')
      setDeleting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#f4f0e6] p-4 py-6 text-[#171614] sm:items-center sm:py-10">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border-2 border-[#171614] bg-[#fffaf0] p-4 shadow-[5px_5px_0_#171614] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-[#171614]">Edit @{handle}</h1>
          <a href={`/${handle}`} className="rounded text-xs font-semibold text-[#b9382a] underline underline-offset-4 transition-colors hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c]">View wall</a>
        </div>

        <div>
          <label className={labelClass}>Owner wallet</label>
          {wallet ? (
            <div className={`flex items-center justify-between gap-2 rounded-lg border px-4 py-3 ${isOwner ? 'border-[#9ab6a2] bg-[#edf5ee]' : 'border-[#d36b61] bg-[#fff0ed]'}`}>
              <span className={`truncate font-mono text-sm font-semibold ${isOwner ? 'text-[#315c3e]' : 'text-[#8f2923]'}`} title={wallet}>{wallet}</span>
              <span className="text-lg shrink-0">{isOwner ? '✓' : '✗'}</span>
            </div>
          ) : inNimiqPay === false ? (
            <div className="space-y-3 rounded-xl border border-[#ef9b88] bg-[#fff0eb] p-4">
              <p className="text-sm leading-relaxed text-[#5f342d]">
                Editing needs your wallet signature, so it has to happen inside Nimiq Pay.
              </p>
              {isMobileDevice() ? (
                <a
                  href={editDeepLink}
                  className="block min-h-12 w-full rounded-xl bg-[#171614] px-4 py-3 text-center font-bold text-[#fffdf7] shadow-[3px_3px_0_#f05a3c] transition-all hover:-translate-y-0.5 hover:bg-[#b9382a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff0eb]"
                >
                  Open in Nimiq Pay
                </a>
              ) : (
                <div className="space-y-2 text-center">
                  {handoffQr && (
                    // eslint-disable-next-line @next/next/no-img-element -- data: URL QR code; nothing to optimize
                    <img src={handoffQr} alt="Scan to open this editor in Nimiq Pay" className="mx-auto max-w-full rounded-lg border border-[#cfc2af] bg-white p-2" width={220} height={220} />
                  )}
                  <p className="text-xs text-[#5f574b]">
                    Scan with your phone to open this editor in Nimiq Pay.
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
              {inNimiqPay === null ? 'Checking wallet…' : connecting ? 'Connecting…' : 'Connect Owner Wallet'}
            </button>
          )}
        </div>

        <fieldset disabled={!isOwner} className="space-y-4 disabled:opacity-60">
          <div>
            <label className={labelClass}>Display Name</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your Name" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Content URL</label>
            <input value={contentUrl} onChange={e => setContentUrl(e.target.value)} placeholder="https://x.com/yourthread" className={`${fieldClass} text-sm`} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Goal (NIM)</label>
              <input type="number" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Goal Label</label>
              <input value={goalLabel} onChange={e => setGoalLabel(e.target.value)} placeholder="Next article" className={fieldClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>What are you currently working on?</label>
            <input value={achievement} onChange={e => setAchievement(e.target.value)} maxLength={80} className={`${fieldClass} text-sm`} />
          </div>
          <div>
            <label className={labelClass}>Telegram tip alert (private)</label>
            <input
              value={notifyTelegram}
              onChange={e => setNotifyTelegram(e.target.value)}
              placeholder="https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=…"
              className={`${fieldClass} text-xs`}
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-[#5f574b]">
              <input type="checkbox" checked={notifyClear} onChange={e => setNotifyClear(e.target.checked)} className="h-3.5 w-3.5 accent-[#f05a3c]" />
              Remove my webhook
            </label>
            <p className="mt-1 text-[11px] text-[#746b5e]">
              Get a Telegram message when a tip lands. Your existing webhook is never shown here; saving a new one replaces it.
            </p>
          </div>
          <div>
            <label className={labelClass}>Tags (up to 3, comma-separated)</label>
            <input
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="tutorials, open-source, music"
              className={`${fieldClass} text-sm`}
            />
            <p className="mt-1 text-[11px] text-[#746b5e]">Free-form keywords shown on your explore card.</p>
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value as CreatorCategory | '')} className={fieldClass}>
              <option value="">No category</option>
              {(Object.keys(CREATOR_CATEGORIES) as CreatorCategory[]).map(c => (
                <option key={c} value={c}>{CREATOR_CATEGORIES[c].emoji} {CREATOR_CATEGORIES[c].label}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[#746b5e]">Used as your filter on /explore so supporters can find you by kind of work.</p>
          </div>
          <div>
            <label className={labelClass}>Wall theme</label>
            <div className="flex flex-wrap gap-2">
              {THEME_SWATCHES.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setTheme(s.id)}
                  aria-pressed={theme === s.id}
                  title={s.label}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${theme === s.id ? 'border-[#171614] shadow-[2px_2px_0_#171614]' : 'border-[#92897b] opacity-70 hover:opacity-100'}`}
                  style={{ background: s.paper, color: '#171614' }}
                >
                  <span className="h-3.5 w-3.5 rounded-full border border-[#171614]/40" style={{ background: s.accent }} aria-hidden />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </fieldset>

        {error && <div className="rounded-xl border border-[#d36b61] bg-[#fff0ed] p-3 text-sm font-medium text-[#8f2923]" role="alert">{error}</div>}
        {saved && <div className="rounded-xl border border-[#9ab6a2] bg-[#edf5ee] p-3 text-sm font-medium text-[#315c3e]" role="status">Saved! Redirecting…</div>}
        <button type="submit" disabled={submitting || !isOwner} className="min-h-12 w-full rounded-xl bg-[#171614] py-3 font-bold text-[#fffdf7] shadow-[3px_3px_0_#f05a3c] transition-all hover:-translate-y-0.5 hover:bg-[#b9382a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-[#171614]">
          {submitting ? 'Sign in wallet…' : 'Save Changes'}
        </button>

        {/* Danger zone: permanent wall deletion (owner wallet only) */}
        {isOwner && (
          <div className="mt-2 space-y-3 rounded-xl border border-[#c9463c] bg-[#fff0ed] p-4">
            <p className="text-sm font-bold text-[#8f2923]">Danger zone</p>
            <p className="text-xs leading-relaxed text-[#6f2824]">
              Deleting your wall permanently removes your profile, tip history, milestones, and
              analytics. The handle <strong>@{handle}</strong> can never be registered again
              (by you or anyone else). This cannot be undone.
            </p>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={`Type "${handle}" to confirm`}
              className="w-full rounded-lg border border-[#c9463c] bg-[#fffdf7] px-4 py-3 text-sm text-[#171614] placeholder:text-[#746b5e] focus:border-[#8f2923] focus:outline-none focus:ring-2 focus:ring-[#c9463c]/20"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteConfirm !== handle || deleting}
              className="min-h-12 w-full rounded-xl bg-[#8f2923] py-3 text-sm font-bold text-[#fffdf7] transition-colors hover:bg-[#6f1f1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f2923] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff0ed] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? 'Sign in wallet…' : 'Delete this wall forever'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
