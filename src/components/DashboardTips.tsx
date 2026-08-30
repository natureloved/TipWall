'use client'
import { useState } from 'react'
import { type Tip } from '@/lib/types'
import { signProfileAuth } from '@/lib/nimiq'
import { timeAgo } from '@/lib/time'

const REPLY_MAX = 120

export default function DashboardTips({ handle, tips, walletAddress }: { handle: string; tips: Tip[]; walletAddress: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [localReplies, setLocalReplies] = useState<Record<string, { message: string; at: number }>>({})

  const recent = tips.slice(0, 15)

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
      if (!res.ok) throw new Error(data.error || 'Failed to save reply')
      setLocalReplies(r => ({ ...r, [tipId]: { message, at: Date.now() } }))
      setOpen(null)
      setDraft('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border-2 border-[#171614] bg-[#fffaf0] p-4 shadow-[5px_5px_0_#171614] sm:p-6">
      <h2 className="font-serif text-lg font-semibold text-[#171614]">Tips & thank-you replies</h2>
      <p className="mt-1 text-xs text-[#746b5e]">Pin a public thank-you note under a tip. Supporters see it on your wall.</p>
      {!recent.length && <p className="mt-4 text-sm text-[#746b5e]">No tips yet - share your wall to get the first one.</p>}
      <ul className="mt-4 space-y-3">
        {recent.map(tip => {
          const reply = localReplies[tip.id] ?? tip.reply
          const who = tip.anonymous ? '🕵️ Anonymous' : tip.senderName || `${tip.senderAddress.slice(0, 6)}…${tip.senderAddress.slice(-4)}`
          return (
            <li key={tip.id} className="rounded-xl border border-[#171614]/25 bg-[#fffdf7] p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-[#171614]">{who}</span>
                <span className="text-sm font-bold text-[#b9382a]">{tip.amountNIM} NIM · <span className="font-medium text-[#746b5e]">{timeAgo(tip.timestamp)}</span></span>
              </div>
              {tip.message && <p className="mt-1 text-sm text-[#5f574b]">“{tip.message}”</p>}
              {reply && (
                <p className="mt-2 rounded-md border border-dashed border-[#171614]/45 bg-[#f4f0e6] px-2.5 py-1.5 text-xs text-[#5f574b]">
                  <span className="font-bold">↳ You:</span> {reply.message}
                </p>
              )}
              {open === tip.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    maxLength={REPLY_MAX}
                    rows={2}
                    placeholder={`Thank ${tip.anonymous ? 'them' : tip.senderName || 'them'}… (${draft.length}/${REPLY_MAX})`}
                    className="w-full resize-none rounded-lg border border-[#92897b] bg-[#fffdf7] p-2 text-sm text-[#171614] focus:border-[#f05a3c] focus:outline-none"
                  />
                  {error && <p className="text-xs font-medium text-[#9d2c21]" role="alert">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitReply(tip.id)}
                      disabled={busy || !draft.trim()}
                      className="rounded-lg bg-[#171614] px-3 py-1.5 text-xs font-bold text-[#fffdf7] shadow-[2px_2px_0_#f05a3c] transition-colors hover:bg-[#b9382a] disabled:opacity-50"
                    >
                      {busy ? 'Sign in wallet…' : 'Pin reply'}
                    </button>
                    <button onClick={() => { setOpen(null); setDraft(''); setError('') }} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#746b5e] hover:text-[#171614]">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setOpen(tip.id); setDraft(reply?.message || ''); setError('') }}
                  className="mt-2 text-xs font-bold text-[#b9382a] underline underline-offset-4 hover:text-[#171614]"
                >
                  {reply ? 'Edit reply' : 'Reply'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
