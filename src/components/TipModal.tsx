import { useState, useRef, useEffect } from 'react'
import QRCode from 'qrcode'
import TipReasonPicker from './TipReasonPicker'
import FiatHint from './FiatHint'
import { TipReason, TIP_REASON_LABELS, type TipAsset } from '@/lib/types'
import { sendNimTip, getSenderAddress } from '@/lib/nimiq'
import { buildUsdtPaymentLink, sendUsdtTip, usdtPaymentsConfigured } from '@/lib/usdt'
import { tipViaHub } from '@/lib/hub'
import { isMobileDevice, NIMIQ_GET_NIM_URL } from '@/lib/environment'
import { savePendingTipIntent } from '@/lib/tip-intent'
import { useTranslations } from '@/lib/i18n'
import { useFocusTrap } from '@/lib/useFocusTrap'

const PRESET_AMOUNTS = [25, 100, 250, 500]

export default function TipModal({ isOpen, onClose, creatorHandle, creatorWalletAddress, creatorUsdtAddress, creatorDisplayName, onTipSuccess, nimiqAvailable = null, onNeedsInstall, initialAmount, initialMessage, welcome = false, claimToken, goal, totalNIM, walletBalanceNim = null, walletBalanceLoading = false }: {
  isOpen: boolean
  onClose: () => void
  creatorHandle: string
  creatorWalletAddress: string
  creatorUsdtAddress?: string
  /** Shown in the Nimiq Hub payment popup so supporters know who they pay. */
  creatorDisplayName?: string
  onTipSuccess: (tip: { senderAddress: string; amountNIM: number; amountUSDT?: number; asset?: TipAsset; message?: string; txHash: string; milestone?: number | null; pending: boolean }) => void
  /** null = unknown/checking, true = inside Nimiq Pay, false = outside. */
  nimiqAvailable?: boolean | null
  /** Called (instead of paying) when the user tries to tip outside Nimiq Pay. */
  onNeedsInstall?: (amountNIM: number, message?: string, reason?: TipReason) => void
  /** Prefill for resuming a preserved tip intent. */
  initialAmount?: number
  initialMessage?: string
  /** Show a welcome banner when resuming after onboarding. */
  welcome?: boolean
  /** When this tip fulfils a claim intent, its token (marks the claim claimed). */
  claimToken?: string
  /** Creator goal - when set, shows a compact progress bar so supporters see the
      impact of their tip. Omitted when the creator hasn't set a goal. */
  goal?: { label: string; targetNIM: number }
  /** Verified lifetime total, used with `goal` to draw the progress bar. */
  totalNIM?: number
  /** Current connected-wallet balance, or null when the read is unavailable. */
  walletBalanceNim?: number | null
  walletBalanceLoading?: boolean
}) {
  // Single source of truth for the amount: one editable field prefilled with a
  // sensible default. Presets fill it; the user can also type any value freely.
  const [amount, setAmount] = useState<string>(initialAmount ? String(initialAmount) : '100')
  const [asset, setAsset] = useState<TipAsset>('NIM')
  // Reason is optional garnish, not a gate. Default to a neutral "just support"
  // so a tip always carries a valid reason without the user having to choose.
  const [reason, setReason] = useState<TipReason>('just_support')
  const [message, setMessage] = useState(initialMessage || '')
  const [anonymous, setAnonymous] = useState(false)
  // Remembered display name so repeat supporters keep their identity without
  // retyping. Read lazily; never touched during SSR.
  const [senderName, setSenderName] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try { return window.localStorage.getItem('tipwall:senderName') || '' } catch { return '' }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [usdtQr, setUsdtQr] = useState('')
  const [manualUsdtHash, setManualUsdtHash] = useState('')
  const sendingRef = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const t = useTranslations()

  useFocusTrap(dialogRef, isOpen)

  // Keep touch and wheel scrolling inside the sheet while it is open. This is
  // especially important on mobile, where a swipe at the edge can otherwise
  // move the wall underneath the dialog.
  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [isOpen])

  // Close on Escape while the modal is open (keyboard accessibility).
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const finalAmount = Number(amount)
  const usdtEnabled = usdtPaymentsConfigured(creatorUsdtAddress)
  const insufficientFunds = asset === 'NIM' && nimiqAvailable === true && walletBalanceNim != null && finalAmount > walletBalanceNim
  const amountLabel = asset === 'USDT' ? 'USDT' : 'NIM'
  let usdtPaymentLink = ''
  if (usdtEnabled && asset === 'USDT' && creatorUsdtAddress && Number.isFinite(finalAmount) && finalAmount > 0) {
    try { usdtPaymentLink = buildUsdtPaymentLink({ recipient: creatorUsdtAddress, amountUSDT: finalAmount }) } catch { /* invalid input leaves the QR hidden */ }
  }

  useEffect(() => {
    if (!usdtPaymentLink) return
    QRCode.toDataURL(usdtPaymentLink, { width: 220, margin: 1, color: { dark: '#171614', light: '#ffffff' } }).then(setUsdtQr).catch(() => setUsdtQr(''))
  }, [usdtPaymentLink])

  // Compact goal progress for the modal - only meaningful when the creator set a
  // goal. Mirrors the wall's logic: true % can exceed 100 (label), bar caps at 100.
  const showGoal = !!goal && goal.targetNIM > 0 && typeof totalNIM === 'number'
  const goalPercentTrue = showGoal ? Math.round((totalNIM! / goal!.targetNIM) * 100) : 0
  const goalPercent = Math.min(100, goalPercentTrue)

  const buildExtraData = () => {
    const parts = [
      reason ? TIP_REASON_LABELS[reason].label : '',
      message.trim(),
    ].filter(Boolean)
    return parts.join(' | ').slice(0, 64) || undefined
  }

  // Shared tail of every successful payment: record the tip server-side,
  // remember the display name, then report success.
  const recordTip = async (txHash: string, senderAddress: string, recordAsset: TipAsset = asset) => {
    const res = await fetch('/api/tips/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle: creatorHandle,
        senderAddress,
        senderName: senderName.trim() || undefined,
        reason,
        message: message.trim() || undefined,
        asset: recordAsset,
        amountNIM: recordAsset === 'NIM' ? finalAmount : 0,
        amountUSDT: recordAsset === 'USDT' ? finalAmount : undefined,
        txHash,
        anonymous,
        claimToken,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to record tip')
    if (senderName.trim()) {
      try { window.localStorage.setItem('tipwall:senderName', senderName.trim()) } catch { /* private mode */ }
    }
    const resolvedSender = typeof data.tip?.senderAddress === 'string' ? data.tip.senderAddress : senderAddress
    onTipSuccess({
      senderAddress: resolvedSender,
      amountNIM: recordAsset === 'NIM' ? finalAmount : 0,
      amountUSDT: recordAsset === 'USDT' ? finalAmount : undefined,
      asset: recordAsset,
      message: message.trim() || undefined,
      txHash,
      milestone: data.milestone?.threshold ?? data.milestoneReached ?? null,
      pending: data.pending === true,
    })
    onClose()
  }

  // Preserve the intent and hand the user to the Nimiq Pay onboarding flow.
  const fallbackToInstall = () => {
    savePendingTipIntent({
      creatorHandle,
      amountNIM: finalAmount,
      message: message.trim() || undefined,
      reason: reason || undefined,
      createdAt: Date.now(),
    })
    onNeedsInstall?.(finalAmount, message.trim() || undefined, reason)
  }

  const preserveTipBeforeAcquisition = () => {
    savePendingTipIntent({
      creatorHandle,
      amountNIM: finalAmount,
      message: message.trim() || undefined,
      reason: reason || undefined,
      createdAt: Date.now(),
    })
  }

  const submitManualUsdt = async (event: React.FormEvent) => {
    event.preventDefault()
    const txHash = manualUsdtHash.trim()
    if (!txHash || loading) return
    setLoading(true)
    setError('')
    try {
      await recordTip(txHash, '', 'USDT')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify the USDT payment')
    } finally {
      setLoading(false)
    }
  }

  const handleSendTip = async () => {
    if (sendingRef.current) return
    const minimum = asset === 'USDT' ? 0.01 : 1
    if (!finalAmount || finalAmount < minimum) return setError(`Minimum tip is ${minimum} ${amountLabel}`)
    if (asset === 'USDT' && !creatorUsdtAddress) return setError('This wall has not enabled USDT tips.')
    sendingRef.current = true

    const reset = () => { sendingRef.current = false }

    try {
      if (asset === 'USDT') {
        setLoading(true)
        setError('')
        const result = await sendUsdtTip({ recipient: creatorUsdtAddress!, amountUSDT: finalAmount })
        await recordTip(result.txHash, result.senderAddress, 'USDT')
        reset()
        return
      }
      // Outside Nimiq Pay (or while detection is still resolving): on phones
      // we hand off to the Nimiq Pay app; on desktop the tip completes right
      // here via the Nimiq Hub popup.
      if (nimiqAvailable !== true) {
        if (isMobileDevice()) {
          fallbackToInstall()
          reset()
          return
        }
        setLoading(true)
        setError('')
        try {
          const { txHash, senderAddress } = await tipViaHub({
            creatorHandle,
            creatorDisplayName,
            creatorWalletAddress,
            amountNim: finalAmount,
            tipMessage: buildExtraData(),
          })
          await recordTip(txHash, senderAddress)
        } catch (e) {
          setError((e as Error).message || 'The payment could not be completed.')
          setLoading(false)
        }
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
      await recordTip(result.txHash, senderAddress)
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
    <div className="tip-modal-overlay fixed inset-0 bg-black/50 flex items-end z-50 backdrop-blur-sm animate-slide-up" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Tip @${creatorHandle}`}
        tabIndex={-1}
        className="tip-modal-sheet relative rounded-t-3xl p-6 w-full max-h-[88vh] overflow-y-auto shadow-2xl border-2 animate-slide-up focus:outline-none"
        onClick={e => e.stopPropagation()}
      >
        <div className="tip-modal-handle mx-auto mb-4 h-1 w-12 rounded-full bg-[#f05a3c]" />

        <div className="tip-modal-heading mb-5">
          <h3 className="tip-modal-title text-2xl font-bold mb-1">
            Tip @{creatorHandle}
          </h3>
          <p className="text-sm text-[#5f574b]">
            {t('tipGoesDirectly')}
          </p>
        </div>

        {usdtEnabled && (
          <div className="mb-5 flex overflow-hidden rounded-xl border-2 border-[#92897b] bg-[#f6efe3] p-1" role="tablist" aria-label={t('paymentAsset')}>
            {(['NIM', 'USDT'] as TipAsset[]).map(option => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={asset === option}
                onClick={() => { setAsset(option); setAmount(option === 'USDT' ? '5' : '100'); setError('') }}
                className={`min-h-10 flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${asset === option ? 'bg-[#171614] text-[#fffdf7]' : 'text-[#5f574b] hover:bg-[#fffdf7]'}`}
              >
                {option === 'USDT' ? t('payWithUsdt') : t('payWithNim')}
              </button>
            ))}
          </div>
        )}

        {welcome && (
          <div className="mb-5 rounded-xl border border-[#9ab6a2] bg-[#edf5ee] px-4 py-3 text-sm font-medium text-[#315c3e]">
            👋 Welcome back! Your tip is ready to send.
          </div>
        )}

        {/* Goal context - shows supporters where their tip lands. Only when a goal exists. */}
        {showGoal && (
          <div className="tip-goal-panel mb-6 rounded-2xl border px-4 py-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="truncate text-xs font-semibold text-[#5f574b]">{goal!.label || t('goalProgress')}</span>
              <span className="shrink-0 text-xs font-bold text-[#b9382a]">{goalPercentTrue}%</span>
            </div>
            <div
              className="relative h-2 w-full overflow-hidden rounded-full bg-[#d8cdbb]"
              role="progressbar"
              aria-valuenow={goalPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={goal!.label || t('goalProgress')}
            >
              <div
                className="h-full rounded-full bg-[#f05a3c] transition-all duration-700"
                style={{ width: `${goalPercent}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-[#746b5e]">
              <span>{totalNIM!.toLocaleString()} NIM</span>
              <span>{goal!.targetNIM.toLocaleString()} NIM</span>
            </div>
          </div>
        )}

        {/* Amount is the decision - it leads. Everything below is garnish. */}
        <div className="tip-amount-section">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#b9382a]">{t('tipAmount')} · {amountLabel}</p>

          {/* Prominent, editable amount field - the focal point of the modal.
              Prefilled with a default; presets below fill it; users can type any value. */}
          <div className="mb-[10px] flex min-h-[54px] items-center gap-3 rounded-xl border-2 border-[#92897b] bg-[#fff3ee] px-3 py-2 transition-colors focus-within:border-[#f05a3c] focus-within:ring-2 focus-within:ring-[#f05a3c] focus-within:ring-offset-2 focus-within:ring-offset-[#fffaf0] sm:mb-4 sm:min-h-[62px] sm:rounded-2xl sm:px-4 sm:py-3">
            <input
              type="number"
              inputMode={asset === 'USDT' ? 'decimal' : 'numeric'}
              enterKeyHint="done"
              min={1}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              aria-label={t('tipAmount')}
              className="tip-modal-amount min-w-0 flex-1 bg-transparent text-3xl font-bold placeholder:text-[#746b5e] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="shrink-0 text-lg font-semibold text-[#b9382a]">{amountLabel}</span>
            {asset === 'NIM' && <FiatHint nim={finalAmount} className="shrink-0 text-xs font-semibold text-[#746b5e]" />}
          </div>

          <div className="tip-amount-grid grid grid-cols-4 gap-2 mb-5">
            {(asset === 'USDT' ? [1, 5, 10, 25] : PRESET_AMOUNTS).map(amt => (
              <button
                key={amt}
                onClick={() => setAmount(String(amt))}
                className={`min-h-[42px] rounded-xl border-2 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0] sm:min-h-[46px] sm:py-2.5 ${
                  Number(amount) === amt
                    ? 'tip-amount-selected shadow-lg hover:shadow-xl'
                    : 'border-[#92897b] bg-[#f6efe3] text-[#171614] hover:border-[#f05a3c] hover:bg-[#fffdf7]'
                }`}
              >
                {amt}
              </button>
            ))}
          </div>
        </div>

        <TipReasonPicker selected={reason} onChange={setReason} />

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={64}
          placeholder={t('sendMessage')}
          rows={2}
          className="mb-[10px] min-h-[60px] w-full resize-none rounded-xl border-2 border-[#92897b] bg-[#fffdf7] p-[10px] text-sm text-[#171614] placeholder:text-[#746b5e] transition-colors hover:border-[#746b5e] focus:border-[#f05a3c] focus:outline-none focus:ring-2 focus:ring-[#f05a3c]/20 sm:mb-4 sm:min-h-[74px] sm:p-3"
        />

        {!anonymous && (
          <input
            value={senderName}
            onChange={e => setSenderName(e.target.value)}
            maxLength={24}
            placeholder={t('senderNamePlaceholder')}
            aria-label={t('senderNameLabel')}
            className="mb-[10px] w-full rounded-xl border-2 border-[#92897b] bg-[#fffdf7] px-3 py-2 text-sm text-[#171614] placeholder:text-[#746b5e] transition-colors hover:border-[#746b5e] focus:border-[#f05a3c] focus:outline-none focus:ring-2 focus:ring-[#f05a3c]/20 sm:mb-3"
          />
        )}

        {asset === 'USDT' && usdtEnabled && (
          <div className="mb-4 rounded-xl border border-[#9ab6a2] bg-[#edf5ee] p-3 text-sm text-[#315c3e]">
            <p className="font-bold">{t('usdtPolygonTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed">{t('usdtPolygonBody')}</p>
            {usdtQr && usdtPaymentLink && <img src={usdtQr} alt={t('usdtQrAlt')} width={220} height={220} className="mx-auto mt-3 rounded-lg border border-[#cfc2af] bg-white p-2" /> /* eslint-disable-line @next/next/no-img-element */}
            <a
              href={usdtPaymentLink || undefined}
              className="mt-3 block text-center text-xs font-bold underline underline-offset-4"
            >
              {t('openUsdtWallet')}
            </a>
            <form onSubmit={submitManualUsdt} className="mt-3 flex gap-2">
              <input value={manualUsdtHash} onChange={event => setManualUsdtHash(event.target.value)} placeholder={t('usdtTxHashPlaceholder')} aria-label={t('usdtTxHashLabel')} className="min-w-0 flex-1 rounded-lg border border-[#92897b] bg-[#fffdf7] px-2.5 py-2 font-mono text-[11px] text-[#171614] focus:border-[#f05a3c] focus:outline-none" />
              <button type="submit" disabled={!manualUsdtHash.trim() || loading} className="min-h-10 shrink-0 rounded-lg bg-[#171614] px-3 py-2 text-xs font-bold text-[#fffdf7] disabled:opacity-50">{t('verifyUsdtPayment')}</button>
            </form>
          </div>
        )}

        {asset === 'NIM' && nimiqAvailable === true && walletBalanceLoading && (
          <p className="mb-4 text-center text-xs font-medium text-[#746b5e]" role="status">
            {t('checkingWalletBalance')}
          </p>
        )}

        {asset === 'NIM' && nimiqAvailable === true && !walletBalanceLoading && walletBalanceNim != null && walletBalanceNim <= 0 && (
          <div className="mb-4 rounded-xl border border-[#d8b06b] bg-[#fff6df] p-3 text-sm text-[#6f5524]" role="status">
            <p className="font-bold">{t('walletHasNoNim')}</p>
            <p className="mt-1 text-xs leading-relaxed">{t('walletNeedsNim')}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <a href={NIMIQ_GET_NIM_URL} onClick={preserveTipBeforeAcquisition} target="_blank" rel="noopener noreferrer" className="font-bold text-[#8f2923] underline underline-offset-4">
                {t('getNim')}
              </a>
              {onNeedsInstall && <button type="button" onClick={fallbackToInstall} className="font-bold text-[#8f2923] underline underline-offset-4">{t('askSomeoneToPay')}</button>}
            </div>
          </div>
        )}

        {asset === 'NIM' && nimiqAvailable === true && !walletBalanceLoading && walletBalanceNim != null && walletBalanceNim > 0 && insufficientFunds && (
          <div className="mb-4 rounded-xl border border-[#d8b06b] bg-[#fff6df] p-3 text-sm text-[#6f5524]" role="status">
            <p className="font-bold">{t('walletBalanceTooLow', { n: walletBalanceNim.toLocaleString(undefined, { maximumFractionDigits: 5 }) })}</p>
            <p className="mt-1 text-xs leading-relaxed">{t('walletNeedsMoreNim', { n: finalAmount.toLocaleString() })}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <a href={NIMIQ_GET_NIM_URL} onClick={preserveTipBeforeAcquisition} target="_blank" rel="noopener noreferrer" className="font-bold text-[#8f2923] underline underline-offset-4">
                {t('getNim')}
              </a>
              {onNeedsInstall && <button type="button" onClick={fallbackToInstall} className="font-bold text-[#8f2923] underline underline-offset-4">{t('askSomeoneToPay')}</button>}
            </div>
          </div>
        )}

        <label className="tip-anonymous-row mb-4 flex cursor-pointer items-center gap-3 text-sm text-[#5f574b] transition-colors hover:text-[#171614]">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={e => setAnonymous(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-2 border-[#746b5e] accent-[#f05a3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] focus-visible:ring-offset-2"
          />
          {t('anonymous')}
        </label>

        {error && (
          <div className="mb-4 rounded-xl border border-[#d36b61] bg-[#fff0ed] p-3 text-sm font-medium text-[#8f2923]" role="alert">
            {error}
          </div>
        )}

        {/* Sticky action bar - Send is always reachable without scrolling.
            The negative margins let the scrim span the modal's full width and
            sit flush with its rounded bottom; padding restores inner spacing. */}
        <div className="tip-modal-footer sticky bottom-0 -mx-6 -mb-6 px-6 pt-4 pb-6">
          <button
            onClick={handleSendTip}
            disabled={loading || !finalAmount}
            className="w-full transform rounded-xl bg-[#171614] py-3.5 text-sm font-bold text-[#fffdf7] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#b9382a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-[#171614]"
          >
            {loading
              ? (nimiqAvailable !== true ? `⏳ ${t('waitingForWallet')}` : t('waiting'))
              : asset === 'USDT'
                ? `💳 ${finalAmount || '?'} USDT: ${t('confirmUsdt')}`
              : nimiqAvailable !== true
                ? (isMobileDevice() ? `⚡ ${t('continueInNimiqPay')}` : `⚡ ${finalAmount || '?'} NIM: ${t('payWithNimiqWallet')}`)
                : `💰 ${finalAmount || '?'} NIM: ${t('confirmTip')}`}
          </button>
          {nimiqAvailable !== true && !isMobileDevice() && (
            <button
              type="button"
              onClick={fallbackToInstall}
              className="mt-2.5 w-full text-center text-xs font-semibold text-[#746b5e] underline underline-offset-4 transition-colors hover:text-[#b9382a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c]"
            >
              {t('preferPhoneWallet')}
            </button>
          )}
          {asset === 'NIM' && (nimiqAvailable !== true || insufficientFunds || (nimiqAvailable === true && walletBalanceNim == null && !walletBalanceLoading)) && (
            <a href={NIMIQ_GET_NIM_URL} onClick={preserveTipBeforeAcquisition} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-xs font-semibold text-[#746b5e] underline underline-offset-4 transition-colors hover:text-[#b9382a]">
              {t('dontHaveNim')}
            </a>
          )}
          <p className="mt-2.5 text-center text-[11px] text-[#746b5e]">
            ⚡ {asset === 'USDT' ? t('usdtDirectHint') : t('tipGoesDirectly')}
          </p>
        </div>
      </div>
    </div>
  )
}
