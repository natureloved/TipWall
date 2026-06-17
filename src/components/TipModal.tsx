'use client'
import { useState } from 'react'
import TipReasonPicker from './TipReasonPicker'
import { TipReason, TIP_REASON_LABELS } from '@/lib/types'
import { sendNimTip } from '@/lib/nimiq'

const PRESET_AMOUNTS = [25, 100, 250, 500]

export default function TipModal({ isOpen, onClose, creatorHandle, creatorWalletAddress, onTipSuccess }: {
  isOpen: boolean
  onClose: () => void
  creatorHandle: string
  creatorWalletAddress: string
  onTipSuccess: (tip: { senderAddress: string; amountNIM: number; message?: string; txHash: string; milestone?: number | null }) => void
}) {
  const [selectedAmount, setSelectedAmount] = useState<number>(100)
  const [customAmount, setCustomAmount] = useState('')
  const [reason, setReason] = useState<TipReason | null>(null)
  const [message, setMessage] = useState('')
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
      const senderAddress = `NQ${result.txHash.slice(2, 10)}`
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
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl p-5 w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <h3 className="text-base font-medium mb-1">Tip @{creatorHandle}</h3>
        <p className="text-sm text-gray-500 mb-4">Your tip goes directly to their Nimiq wallet.</p>

        <TipReasonPicker selected={reason} onChange={setReason} />

        <p className="text-xs text-gray-500 mb-2 font-medium">Choose an amount</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {PRESET_AMOUNTS.map(amt => (
            <button key={amt} onClick={() => { setSelectedAmount(amt); setCustomAmount('') }}
              className={`py-2.5 rounded-xl text-sm border transition-colors ${selectedAmount === amt && !customAmount ? 'border-[#F6B221] bg-[#FAEEDA] text-[#633806] font-medium' : 'border-gray-200 text-gray-700'}`}>
              {amt} NIM
            </button>
          ))}
        </div>

        <input type="number" value={customAmount} onChange={e => { setCustomAmount(e.target.value); setSelectedAmount(0) }}
          placeholder="Custom amount in NIM..."
          className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-3" />

        <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={64}
          placeholder="Add a message (optional)" rows={2}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-3 resize-none" />

        <label className="flex items-center gap-2 text-sm text-gray-500 mb-4 cursor-pointer">
          <input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} />
          Send anonymously
        </label>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <button onClick={handleSendTip} disabled={loading || !finalAmount || !reason}
          className="w-full py-3.5 bg-[#F6B221] text-[#412402] font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm">
          {loading ? 'Waiting for Nimiq Pay confirmation...' : `Send ${finalAmount || '?'} NIM via Nimiq Pay`}
        </button>
      </div>
    </div>
  )
}
