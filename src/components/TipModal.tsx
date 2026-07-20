import { useState, useRef, useEffect } from 'react'
import TipReasonPicker from './TipReasonPicker'
import { TipReason, TIP_REASON_LABELS } from '@/lib/types'
import { sendNimTip, getSenderAddress } from '@/lib/nimiq'
import { savePendingTipIntent } from '@/lib/tip-intent'
import { useTranslations } from '@/lib/i18n'

const PRESET_AMOUNTS = [25, 100, 250, 500]

export default function TipModal({ isOpen, onClose, creatorHandle, creatorWalletAddress, onTipSuccess, nimiqAvailable = null, onNeedsInstall, initialAmount, initialMessage, welcome = false, claimToken }: {
  isOpen: boolean
  onClose: () => void
  creatorHandle: string
  creatorWalletAddress: string
  onTipSuccess: (tip: { senderAddress: string; amountNIM: number; message?: string; txHash: string; milestone?: number | null }) => void
  /** null = unknown/checking, true = inside Nimiq Pay, false = outside. */
  nimiqAvailable?: boolean | null
  /** Called (instead of paying) when the user tries to tip outside Nimiq Pay. */
  onNeedsInstall?: (amountNIM: number) => void
  /** Prefill for resuming a preserved tip intent. */
  initialAmount?: number
  initialMessage?: string
  /** Show a welcome banner when resuming after onboarding. */
  welcome?: boolean
  /** When this tip fulfils a claim intent, its token (marks the claim claimed). */
  claimToken?: string
}) {
  // Single source of truth for the amount: one editable field prefilled with a
  // sensible default. Presets fill it; the user can also type any value freely.
  const [amount, setAmount] = useState<string>(initialAmount ? String(initialAmount) : '100')
  const [reason, setReason] = useState<TipReason | null>(null)
  const [message, setMessage] = useState(initialMessage || '')
  const [anonymous, setAnonymous] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const sendingRef = useRef(false)
  const t = useTranslations()

  // Close on Escape while the modal is open (keyboard accessibility).
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const finalAmount = Number(amount)

  const buildExtraData = () => {
    const parts = [
      reason ? TIP_REASON_LABELS[reason].label : '',
      message.trim(),
    ].filter(Boolean)
    return parts.join(' | ').slice(0, 64) || undefined
  }

  const handleSendTip = async () => {
    if (sendingRef.current) return
    if (!finalAmount || finalAmount < 1) return setError('Minimum tip is 1 NIM')
    sendingRef.current = true

    const reset = () => { sendingRef.current = false }

    try {
      if (!reason) { setError('Please select a reason for your tip'); reset(); return }

      // Outside Nimiq Pay: a payment can't complete here. Preserve the intent and
      // route the user into the onboarding flow instead of failing.
      if (nimiqAvailable === false) {
        savePendingTipIntent({
          creatorHandle,
          amountNIM: finalAmount,
          message: message.trim() || undefined,
          reason: reason || undefined,
          createdAt: Date.now(),
        })
        onNeedsInstall?.(finalAmount)
        reset()
        return
      }

      setLoading(true)
      setError('')
      const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const result = await sendNimTip({
        creatorWalletAddress,
        amountNim: finalAmount,
        tipMessage: buildExtraData(),
        appUrl,
      })
      if (result.error) {
        setLoading(false)
        if (result.error.toLowerCase().includes('cancel') || result.error.toLowerCase().includes('decline')) {
          setError('Transaction cancelled.')
        } else {
          setError(result.error)
        }
        reset()
        return
      }
      if (!result.txHash) {
        setError('Payment failed')
        setLoading(false)
        reset()
        return
      }
      const senderAddress = await getSenderAddress() || ''
      const res = await fetch('/api/tips/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: creatorHandle,
          senderAddress,
          reason,
          message: message.trim() || undefined,
          amountNIM: finalAmount,
          txHash: result.txHash,
          anonymous,
          claimToken,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to record tip')
      onTipSuccess({
        senderAddress,
        amountNIM: finalAmount,
        message: message.trim() || undefined,
        txHash: result.txHash,
        milestone: data.milestone?.threshold ?? data.milestoneReached ?? null,
      })
      onClose()
    } catch (e) {
      const error = e as Error
      setError(error.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
      reset()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50 backdrop-blur-sm animate-slide-up" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Tip @${creatorHandle}`}
        className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-t-3xl p-6 w-full max-h-[85vh] overflow-y-auto shadow-2xl border-t-2 border-amber-400/20 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full mx-auto mb-6" />

        <div className="mb-6">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent mb-1">
            Tip @{creatorHandle}
          </h3>
          <p className="text-sm text-gray-300">
            Your tip goes directly to their Nimiq wallet
          </p>
        </div>

        {welcome && (
          <div className="mb-5 rounded-xl bg-emerald-400/10 border border-emerald-400/30 px-4 py-3 text-sm text-emerald-200">
            👋 Welcome back! Your tip is ready to send.
          </div>
        )}

        <TipReasonPicker selected={reason} onChange={setReason} />

        <div className="mt-6">
          <p className="text-xs font-bold text-amber-300 uppercase tracking-widest mb-3">{t('tipAmount')}</p>

          {/* Prominent, editable amount field — the focal point of the modal.
              Prefilled with a default; presets below fill it; users can type any value. */}
          <div className="mb-4 rounded-2xl bg-amber-400/10 border-2 border-amber-400/40 focus-within:border-amber-400 px-4 py-3 flex items-center gap-3 transition-colors">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              aria-label={t('tipAmount')}
              className="flex-1 min-w-0 bg-transparent text-3xl font-bold text-white placeholder-gray-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-lg font-semibold text-amber-300 shrink-0">NIM</span>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {PRESET_AMOUNTS.map(amt => (
              <button
                key={amt}
                onClick={() => setAmount(String(amt))}
                className={`py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${
                  Number(amount) === amt
                    ? 'border-amber-400 bg-gradient-to-br from-amber-400 to-amber-500 text-slate-900 shadow-lg hover:shadow-xl'
                    : 'border-amber-400/20 bg-slate-800/50 text-amber-300 hover:border-amber-400/40 hover:bg-slate-800'
                }`}
              >
                {amt}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={64}
          placeholder={t('sendMessage')}
          rows={2}
          className="w-full border-2 border-amber-400/20 hover:border-amber-400/40 rounded-xl p-3 text-sm mb-4 bg-slate-800/50 text-white placeholder-gray-400 focus:outline-none focus:border-amber-400/60 transition-colors resize-none"
        />

        <label className="flex items-center gap-3 text-sm text-gray-300 mb-4 cursor-pointer hover:text-gray-200 transition-colors">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={e => setAnonymous(e.target.checked)}
            className="w-4 h-4 rounded border-2 border-amber-400/40 accent-amber-400 cursor-pointer"
          />
          {t('anonymous')}
        </label>

        {error && (
          <div className="text-red-400 text-sm mb-4 bg-red-400/10 border border-red-400/30 rounded-xl p-3">
            {error}
          </div>
        )}

        <button
          onClick={handleSendTip}
          disabled={loading || !finalAmount || (nimiqAvailable !== false && !reason)}
          className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-lg hover:shadow-xl hover:from-amber-500 hover:to-amber-600 transition-all duration-300 disabled:hover:shadow-lg transform hover:-translate-y-1 disabled:hover:-translate-y-0"
        >
          {loading
            ? t('waiting')
            : nimiqAvailable === false
              ? `⚡ Continue in Nimiq Pay`
              : `💰 ${finalAmount || '?'} NIM — ${t('confirmTip')}`}
        </button>
      </div>
    </div>
  )
}
