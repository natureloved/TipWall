'use client'
import { useState } from 'react'
import { type Tip } from '@/lib/types'
import { signProfileAuth } from '@/lib/nimiq'
import { localizedTimeAgo } from '@/lib/time'
import { useLocale, useTranslations } from '@/lib/i18n'

const REPLY_MAX = 120

export default function DashboardTips({ handle, tips, walletAddress }: { handle: string; tips: Tip[]; walletAddress: string }) {
  const t = useTranslations()
  const locale = useLocale()
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [localReplies, setLocalReplies] = useState<Record<string, { message: string; at: number }>>({})
  const [localTips, setLocalTips] = useState(tips)

  const recent = localTips.slice(0, 15)

  const submitReply = async (tipId: string) => {
    const message = draft.trim().slice(0, REPLY_MAX)
    if (!message || busy) return
    setBusy(true)
    setError('')
    try {
      const auth = await signProfileAuth({ action: 'update', handle, walletAddress })
      const res = await fetch(`/api/tips/${handle}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipId, message, auth }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('dashReplyError'))
      setLocalReplies(r => ({ ...r, [tipId]: { message, at: Date.now() } }))
      setOpen(null)
      setDraft('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const moderate = async (tipId: string, action: 'hide' | 'restore' | 'delete') => {
    if (busy) return
    if (action === 'delete' && !window.confirm(t('dashTipsDeleteConfirm'))) return
    setBusy(true)
    setError('')
    try {
      const auth = await signProfileAuth({ action: 'update', handle, walletAddress })
      const res = await fetch(`/api/tips/${handle}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipId, action, auth }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('dashModerateError'))
      setLocalTips(current => current.map(t => {
        if (t.id !== tipId) return t
        if (action === 'delete') return { ...t, message: undefined, senderName: undefined, reply: undefined, anonymous: true, hiddenAt: Date.now(), deletedAt: Date.now() }
        return { ...t, hiddenAt: action === 'hide' ? Date.now() : undefined }
      }))
      if (action === 'delete') setLocalReplies(current => {
        const next = { ...current }
        delete next[tipId]
        return next
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border-2 border-[#171614] bg-[#fffaf0] p-4 shadow-[5px_5px_0_#171614] sm:p-6">
      <h2 className="font-serif text-lg font-semibold text-[#171614]">{t('dashTipsTitle')}</h2>
      <p className="mt-1 text-xs text-[#746b5e]">{t('dashTipsBody')}</p>
      {!recent.length && <p className="mt-4 text-sm text-[#746b5e]">{t('dashTipsEmpty')}</p>}
      <ul className="mt-4 space-y-3">
        {recent.map(tip => {
          const reply = localReplies[tip.id] ?? tip.reply
          const who = tip.anonymous ? `🕵️ ${t('dashAnonymous')}` : tip.senderName || `${tip.senderAddress.slice(0, 6)}…${tip.senderAddress.slice(-4)}`
          return (
            <li key={tip.id} className="rounded-xl border border-[#171614]/25 bg-[#fffdf7] p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-[#171614]">{who}</span>
                <span className="text-sm font-bold text-[#b9382a]">{tip.asset === 'USDT' ? `${tip.amountUSDT || 0} USDT` : `${tip.amountNIM} NIM`} · <span className="font-medium text-[#746b5e]">{localizedTimeAgo(tip.timestamp, locale)}</span></span>
              </div>
              {tip.message && <p className="mt-1 text-sm text-[#5f574b]">“{tip.message}”</p>}
              {tip.hiddenAt && (
                <p className="mt-2 rounded-md border border-[#d36b61] bg-[#fff0ed] px-2.5 py-1.5 text-xs font-semibold text-[#8f2923]">
                  {t(tip.deletedAt ? 'dashTipsDeleted' : 'dashTipsHidden')}
                </p>
              )}
              {reply && (
                <p className="mt-2 rounded-md border border-dashed border-[#171614]/45 bg-[#f4f0e6] px-2.5 py-1.5 text-xs text-[#5f574b]">
                  <span className="font-bold">↳ {t('dashTipsYou')}:</span> {reply.message}
                </p>
              )}
              {open === tip.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    maxLength={REPLY_MAX}
                    rows={2}
                    placeholder={t('dashReplyPlaceholder', { n: draft.length, max: REPLY_MAX })}
                    className="w-full resize-none rounded-lg border border-[#92897b] bg-[#fffdf7] p-2 text-sm text-[#171614] focus:border-[#f05a3c] focus:outline-none"
                  />
                  {error && <p className="text-xs font-medium text-[#9d2c21]" role="alert">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitReply(tip.id)}
                      disabled={busy || !draft.trim()}
                      className="rounded-lg bg-[#171614] px-3 py-1.5 text-xs font-bold text-[#fffdf7] shadow-[2px_2px_0_#f05a3c] transition-colors hover:bg-[#b9382a] disabled:opacity-50"
                    >
                      {busy ? t('editSaving') : t('dashTipsPinReply')}
                    </button>
                    <button onClick={() => { setOpen(null); setDraft(''); setError('') }} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#746b5e] hover:text-[#171614]">
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <button
                    onClick={() => { setOpen(tip.id); setDraft(reply?.message || ''); setError('') }}
                    className="text-xs font-bold text-[#b9382a] underline underline-offset-4 hover:text-[#171614]"
                  >
                    {reply ? t('dashTipsEditReply') : t('dashTipsReply')}
                  </button>
                  {!tip.deletedAt && <button
                    onClick={() => moderate(tip.id, tip.hiddenAt ? 'restore' : 'hide')}
                    className="text-xs font-bold text-[#5f574b] underline underline-offset-4 hover:text-[#171614]"
                  >
                    {tip.hiddenAt ? t('dashTipsRestore') : t('dashTipsHide')}
                  </button>}
                  {!tip.deletedAt && <button
                    onClick={() => moderate(tip.id, 'delete')}
                    className="text-xs font-bold text-[#9d2c21] underline underline-offset-4 hover:text-[#171614]"
                  >
                    {t('dashTipsDelete')}
                  </button>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
