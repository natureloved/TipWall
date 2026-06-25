import { useState } from 'react'
import TipReasonPicker from './TipReasonPicker'
import { TipReason, TIP_REASON_LABELS } from '@/lib/types'
import { sendNimTip, getSenderAddress } from '@/lib/nimiq'
import { savePendingTipIntent } from '@/lib/tip-intent'

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
  const presetInitial = initialAmount && PRESET_AMOUNTS.includes(initialAmount)
  const [selectedAmount, setSelectedAmount] = useState<number>(presetInitial ? initialAmount! : initialAmount ? 0 : 100)
  const [customAmount, setCustomAmount] = useState(initialAmount && !presetInitial ? String(initialAmount) : '')
  const [reason, setReason] = useState<TipReason | null>(null)
  const [message, setMessage] = useState(initialMessage || '')
  const [anonymous, setAnonymous] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const finalAmount = customAmount ? Number(customAmount) : selectedAmount

  const buildExtraData = () => {
    const parts = [
      reason ? TIP_REASON_LABELS[reason].label : '',
      message.trim(),
    ].filter(Boolean)
    return parts.join(' | ').slice(0, 64) || undefined
  }

  const handleSendTip = async () => {
    if (!finalAmount || finalAmount < 1) return setError('Minimum tip is 1 NIM')

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
      return
    }

    if (!reason) return setError('Please select a reason for your tip')
    setLoading(true)
    setError('')
    try {
      const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const result = await sendNimTip({
        creatorWalletAddress,
        amountNim: finalAmount,
        tipMessage: buildExtraData(),
        appUrl,
      })
      if (result.error) {
        if (result.error.toLowerCase().includes('cancel') || result.error.toLowerCase().includes('decline')) {
          setError('Transaction cancelled.')
        } else {
          setError(result.error)
        }
        setLoading(false)
        return
      }
      if (!result.txHash) {
        setError('Payment failed')
        setLoading(false)
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
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50 backdrop-blur-sm animate-slide-up" onClick={onClose}>
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-t-3xl p-6 w-full max-h-[85vh] overflow-y-auto shadow-2xl border-t-2 border-amber-400/20 animate-slide-up" onClick={e => e.stopPropagation()}>
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
          <p className="text-xs font-bold text-amber-300 uppercase tracking-widest mb-3">Choose an amount</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {PRESET_AMOUNTS.map(amt => (
              <button
                key={amt}
                onClick={() => {
                  setSelectedAmount(amt)
                  setCustomAmount('')
                }}
                className={`py-3 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${
                  selectedAmount === amt && !customAmount
                    ? 'border-amber-400 bg-gradient-to-br from-amber-400 to-amber-500 text-slate-900 shadow-lg hover:shadow-xl'
                    : 'border-amber-400/20 bg-slate-800/50 text-amber-300 hover:border-amber-400/40 hover:bg-slate-800'
                }`}
              >
                {amt} NIM
              </button>
            ))}
          </div>
        </div>

        <input
          type="number"
          value={customAmount}
          onChange={e => {
            setCustomAmount(e.target.value)
            setSelectedAmount(0)
          }}
          placeholder="Custom amount in NIM..."
          className="w-full border-2 border-amber-400/20 hover:border-amber-400/40 rounded-xl p-3 text-sm mb-4 bg-slate-800/50 text-white placeholder-gray-400 focus:outline-none focus:border-amber-400/60 transition-colors"
        />

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={64}
          placeholder="Add a message (optional)"
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
          Send anonymously
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
            ? '⏳ Waiting for Nimiq Pay confirmation...'
            : nimiqAvailable === false
              ? `⚡ Continue in Nimiq Pay`
              : `💰 Send ${finalAmount || '?'} NIM via Nimiq Pay`}
        </button>
      </div>
    </div>
  )
}
