'use client'
import { useEffect, useState, useRef } from 'react'
import QRCode from 'qrcode'
import {
  NIMIQ_PAY_IOS_URL,
  NIMIQ_PAY_ANDROID_URL,
  NIMIQ_PAY_LANDING_URL,
  buildNimiqPayDeepLink,
  isMobileDevice,
  wallUrl,
} from '@/lib/environment'
import { generatePayNonce, composePayMessage, buildNimiqPaymentLink } from '@/lib/pay-request'

type Tab = 'install' | 'pay'

/**
 * Onboarding screen shown when a visitor opens a TipWall outside Nimiq Pay.
 * - "Scan to Pay" tab: shows a `nimiq:` payment-request QR the user scans with
 *   the Nimiq Pay app's built-in scanner. Polls /api/tips/detect for the tx,
 *   then submits it via /api/tips/submit - no mini-app context needed.
 * - "Get Nimiq Pay" tab: original install/deep-link flow.
 */
export default function InstallNimiqPrompt({
  creatorHandle,
  creatorWalletAddress,
  amountNIM,
  onClose,
  targetUrl,
  onTipSuccess,
}: {
  creatorHandle: string
  /** Required for the scan-to-pay tab. */
  creatorWalletAddress?: string
  amountNIM?: number
  onClose?: () => void
  targetUrl?: string
  onTipSuccess?: (tip: { senderAddress: string; amountNIM: number; txHash: string; pending: boolean }) => void
}) {
  const canPay = !!(amountNIM && creatorWalletAddress)
  const [tab, setTab] = useState<Tab>(canPay ? 'pay' : 'install')

  // ── install tab state ────────────────────────────────────────────────────
  const [mobile] = useState(() => isMobileDevice())
  const [deepLink] = useState(() => buildNimiqPayDeepLink(targetUrl || wallUrl(creatorHandle)))
  const [installQr, setInstallQr] = useState('')
  const [pledging, setPledging] = useState(false)
  const [pledgeUrl, setPledgeUrl] = useState('')
  const [copied, setCopied] = useState(false)

  // ── pay tab state ────────────────────────────────────────────────────────
  const nonceRef = useRef(generatePayNonce())
  const [payQr, setPayQr] = useState('')
  const [payStatus, setPayStatus] = useState<'waiting' | 'found' | 'submitting' | 'pending' | 'done' | 'error'>('waiting')
  const [payError, setPayError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  // Build install QR (deep link into mini-app)
  useEffect(() => {
    QRCode.toDataURL(deepLink, { width: 220, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setInstallQr).catch(() => setInstallQr(''))
  }, [deepLink])

  // Build payment QR (`nimiq:` URI) and start polling when on pay tab
  useEffect(() => {
    if (tab !== 'pay' || !canPay) return
    const nonce = nonceRef.current
    // Only match payments made after the QR was shown (guards against matching a
    // pre-existing identical-amount tip to this creator).
    const since = Date.now()
    const message = composePayMessage(undefined, nonce)
    const uri = buildNimiqPaymentLink({ address: creatorWalletAddress!, amountNIM: amountNIM!, message })
    QRCode.toDataURL(uri, { width: 240, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setPayQr).catch(() => setPayQr(''))

    if (payStatus !== 'waiting') return
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/tips/detect?handle=${encodeURIComponent(creatorHandle)}&nonce=${nonce}&amountNIM=${amountNIM}&since=${since}`,
        )
        const data = await res.json()
        if (!data.found) return
        clearInterval(pollRef.current!)
        setPayStatus('submitting')
        const sub = await fetch('/api/tips/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            handle: creatorHandle,
            senderAddress: data.senderAddress || '',
            txHash: data.txHash,
            amountNIM: amountNIM,
            anonymous: false,
          }),
        })
        const submitted = await sub.json().catch(() => ({}))
        if (!sub.ok) {
          const err = submitted
          // 409 = already recorded (e.g. duplicate poll hit) - treat as success
          if (sub.status !== 409) { setPayStatus('error'); setPayError(err.error || 'Failed to record tip'); return }
        }
        setPayStatus(submitted.pending === true ? 'pending' : 'done')
        onTipSuccess?.({ senderAddress: data.senderAddress || '', amountNIM: amountNIM!, txHash: data.txHash, pending: submitted.pending === true })
      } catch { /* network blip - retry next tick */ }
    }, 5000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // Escape key
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const createPledge = async () => {
    if (!amountNIM) return
    setPledging(true)
    try {
      const res = await fetch('/api/claim/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorHandle, amountNIM, source: 'pledge' }),
      })
      const data = await res.json()
      if (res.ok && data.claimUrl) {
        const origin = typeof window !== 'undefined' ? window.location.origin : ''
        setPledgeUrl(`${origin}${data.claimUrl}`)
      }
    } catch { /* ignore */ } finally { setPledging(false) }
  }

  const copyPledge = async () => {
    try { await navigator.clipboard.writeText(pledgeUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={`Support @${creatorHandle}`}
        className="w-full max-h-[96dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t-2 border-[#f05a3c] bg-[#fffaf0] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-[#171614] shadow-[0_-10px_40px_rgba(23,22,20,0.22)] animate-slide-up sm:max-w-md sm:rounded-2xl sm:border-2 sm:p-6 sm:pb-6 sm:shadow-[7px_7px_0_#171614]"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-[#f05a3c] sm:hidden" />

        <div className="text-center mb-5">
          <div className="text-4xl mb-2">⚡</div>
          <h2 className="text-2xl font-bold text-[#b9382a]">
            Support @{creatorHandle}
          </h2>
          {amountNIM && (
            <p className="mt-1 text-sm text-[#5f574b]">
              {amountNIM} NIM tip
            </p>
          )}
        </div>

        {/* Tabs - only show when both flows are available */}
        {canPay && (
          <div className="mb-5 flex overflow-hidden rounded-xl border border-[#92897b] bg-[#f4f0e6] p-1">
            {(['pay', 'install'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`min-h-10 flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0] ${
                  tab === t
                    ? 'bg-[#171614] text-[#fffdf7] shadow-sm'
                    : 'text-[#5f574b] hover:bg-[#fffdf7] hover:text-[#b9382a]'
                }`}
              >
                {t === 'pay' ? '📷 Scan to Pay' : '📱 Get Nimiq Pay'}
              </button>
            ))}
          </div>
        )}

        {/* ── Scan-to-Pay tab ── */}
        {tab === 'pay' && canPay && (
          <>
            {payStatus === 'done' ? (
              <div className="text-center py-6">
                <div className="text-5xl mb-3">🎉</div>
                <p className="text-lg font-bold text-[#3f6f4d]">Tip sent!</p>
                <p className="mt-1 text-sm text-[#5f574b]">Thank you for supporting @{creatorHandle}.</p>
                {onClose && (
                  <button onClick={onClose} className="mt-4 min-h-11 rounded-xl bg-[#171614] px-5 py-2 text-sm font-bold text-[#fffdf7] transition-colors hover:bg-[#b9382a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0]">
                    Close
                  </button>
                )}
              </div>
            ) : payStatus === 'pending' ? (
              <div className="text-center py-6">
                <div className="text-5xl mb-3">⏳</div>
                <p className="text-lg font-bold text-[#8a6a2f]">Payment received</p>
                <p className="mt-1 text-sm text-[#5f574b]">Your tip is recorded and waiting for on-chain confirmation.</p>
                {onClose && (
                  <button onClick={onClose} className="mt-4 min-h-11 rounded-xl bg-[#171614] px-5 py-2 text-sm font-bold text-[#fffdf7] transition-colors hover:bg-[#b9382a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0]">
                    Close
                  </button>
                )}
              </div>
            ) : payStatus === 'error' ? (
              <div className="text-center py-4">
                <p className="mb-3 rounded-xl border border-[#d36b61] bg-[#fff0ed] p-3 text-sm font-medium text-[#8f2923]">{payError}</p>
                <button onClick={() => { setPayStatus('waiting'); setPayError('') }} className="min-h-10 rounded-lg px-3 text-xs font-semibold text-[#b9382a] underline underline-offset-4 hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c]">
                  Try again
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center gap-3 mb-4">
                  {payQr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={payQr} alt="Scan to pay with Nimiq Pay" className="max-w-full rounded-xl border border-[#cfc2af] bg-white p-2 shadow-sm" width={240} height={240} />
                  ) : (
                    <div className="h-[240px] w-[240px] max-w-full animate-pulse rounded-xl border border-[#d8cdbb] bg-[#e9e2d2]" />
                  )}
                  <p className="text-center text-xs leading-relaxed text-[#5f574b]">
                    Open Nimiq Pay → tap the scanner → scan this code to send {amountNIM} NIM directly.
                  </p>
                </div>
                {(payStatus === 'waiting') && (
                  <div className="mb-4 flex items-center justify-center gap-2 text-xs font-medium text-[#746b5e]">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#f05a3c]" />
                    Waiting for payment…
                  </div>
                )}
                {payStatus === 'submitting' && (
                  <div className="mb-4 flex items-center justify-center gap-2 text-xs font-medium text-[#3f6f4d]">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#3f6f4d]" />
                    Payment detected. Recording…
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <a href={NIMIQ_PAY_IOS_URL} target="_blank" rel="noopener noreferrer"
                    className="min-h-11 rounded-xl border border-[#92897b] bg-[#fffdf7] px-2 py-2.5 text-center text-sm font-semibold text-[#171614] transition-colors hover:border-[#f05a3c] hover:bg-[#ffe3da] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c]">
                     App Store
                  </a>
                  <a href={NIMIQ_PAY_ANDROID_URL} target="_blank" rel="noopener noreferrer"
                    className="min-h-11 rounded-xl border border-[#92897b] bg-[#fffdf7] px-2 py-2.5 text-center text-sm font-semibold text-[#171614] transition-colors hover:border-[#f05a3c] hover:bg-[#ffe3da] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c]">
                    ▶ Google Play
                  </a>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Install tab (original flow) ── */}
        {tab === 'install' && (
          <>
            <p className="mb-4 text-center text-xs text-[#746b5e]">
              To send NIM tips, open this wall in Nimiq Pay.
            </p>
            {mobile ? (
              <a href={deepLink}
                className="mb-3 block min-h-12 w-full rounded-xl bg-[#171614] px-4 py-3.5 text-center font-bold text-[#fffdf7] shadow-[3px_3px_0_#f05a3c] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#b9382a] hover:shadow-[4px_4px_0_#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0]">
                ⚡ Open in Nimiq Pay
              </a>
            ) : (
              <div className="flex flex-col items-center gap-3 mb-4">
                {installQr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={installQr} alt="Scan to open in Nimiq Pay" className="h-auto max-w-full rounded-xl border border-[#cfc2af] bg-white p-2 shadow-sm" width={220} height={220} />
                ) : (
                  <div className="h-[220px] w-[220px] max-w-full animate-pulse rounded-xl border border-[#d8cdbb] bg-[#e9e2d2]" />
                )}
                <p className="text-center text-xs text-[#5f574b]">
                  Scan with your phone to open this wall inside Nimiq Pay
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-5">
              <a href={NIMIQ_PAY_IOS_URL} target="_blank" rel="noopener noreferrer"
                className="min-h-11 rounded-xl border border-[#92897b] bg-[#fffdf7] px-2 py-2.5 text-center text-sm font-semibold text-[#171614] transition-colors hover:border-[#f05a3c] hover:bg-[#ffe3da] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c]">
                 App Store
              </a>
              <a href={NIMIQ_PAY_ANDROID_URL} target="_blank" rel="noopener noreferrer"
                className="min-h-11 rounded-xl border border-[#92897b] bg-[#fffdf7] px-2 py-2.5 text-center text-sm font-semibold text-[#171614] transition-colors hover:border-[#f05a3c] hover:bg-[#ffe3da] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c]">
                ▶ Google Play
              </a>
            </div>

            {amountNIM && (
              <div className="mb-5">
                {pledgeUrl ? (
                  <div className="rounded-xl border border-[#9ab6a2] bg-[#edf5ee] p-3">
                    <p className="mb-1 text-sm font-semibold text-[#315c3e]">Your support has been reserved.</p>
                    <p className="mb-2 text-[11px] text-[#5f574b]">Open this link in Nimiq Pay anytime to finish.</p>
                    <div className="flex flex-col sm:flex-row items-stretch gap-2">
                      <input readOnly value={pledgeUrl} className="min-w-0 flex-1 truncate rounded-lg border border-[#92897b] bg-[#fffdf7] px-3 py-2 font-mono text-xs text-[#171614] focus:outline-none focus:ring-2 focus:ring-[#f05a3c]" />
                      <button type="button" onClick={copyPledge} className="min-h-10 w-full shrink-0 rounded-lg bg-[#171614] px-3 py-2 text-xs font-semibold text-[#fffdf7] transition-colors hover:bg-[#b9382a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] sm:w-auto">
                        {copied ? '✓' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={createPledge} disabled={pledging}
                    className="min-h-11 w-full rounded-xl border border-[#746b5e] bg-[#fffdf7] px-3 py-2.5 text-sm font-semibold text-[#171614] transition-colors hover:border-[#f05a3c] hover:bg-[#ffe3da] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c] disabled:cursor-not-allowed disabled:opacity-60">
                    {pledging ? 'Reserving…' : 'Support Later: get a claim link'}
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <a href={NIMIQ_PAY_LANDING_URL} target="_blank" rel="noopener noreferrer"
                className="rounded text-xs font-semibold text-[#b9382a] underline underline-offset-4 transition-colors hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c]">
                Learn more
              </a>
              {onClose && (
                <button onClick={onClose} className="min-h-10 rounded px-2 text-xs font-semibold text-[#5f574b] transition-colors hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05a3c]">
                  Maybe later
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
