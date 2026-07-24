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
 *   then submits it via /api/tips/submit — no mini-app context needed.
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
  onTipSuccess?: (tip: { senderAddress: string; amountNIM: number; txHash: string }) => void
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
  const [payStatus, setPayStatus] = useState<'waiting' | 'found' | 'submitting' | 'done' | 'error'>('waiting')
  const [payError, setPayError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Build install QR (deep link into mini-app)
  useEffect(() => {
    QRCode.toDataURL(deepLink, { width: 220, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setInstallQr).catch(() => setInstallQr(''))
  }, [deepLink])

  // Build payment QR (`nimiq:` URI) and start polling when on pay tab
  useEffect(() => {
    if (tab !== 'pay' || !canPay) return
    const nonce = nonceRef.current
    const message = composePayMessage(undefined, nonce)
    const uri = buildNimiqPaymentLink({ address: creatorWalletAddress!, amountNIM: amountNIM!, message })
    QRCode.toDataURL(uri, { width: 240, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setPayQr).catch(() => setPayQr(''))

    if (payStatus !== 'waiting') return
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/tips/detect?handle=${encodeURIComponent(creatorHandle)}&nonce=${nonce}&amountNIM=${amountNIM}`,
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
        if (!sub.ok) {
          const err = await sub.json()
          // 409 = already recorded (e.g. duplicate poll hit) — treat as success
          if (sub.status !== 409) { setPayStatus('error'); setPayError(err.error || 'Failed to record tip'); return }
        }
        setPayStatus('done')
        onTipSuccess?.({ senderAddress: data.senderAddress || '', amountNIM: amountNIM!, txHash: data.txHash })
      } catch { /* network blip — retry next tick */ }
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={`Support @${creatorHandle}`}
        className="w-full sm:max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto shadow-2xl border-t-2 sm:border-2 border-amber-400/20 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full mx-auto mb-5 sm:hidden" />

        <div className="text-center mb-5">
          <div className="text-4xl mb-2">⚡</div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">
            Support @{creatorHandle}
          </h2>
          {amountNIM && (
            <p className="text-sm text-gray-300 mt-1">
              {amountNIM} NIM tip
            </p>
          )}
        </div>

        {/* Tabs — only show when both flows are available */}
        {canPay && (
          <div className="flex rounded-xl overflow-hidden border border-amber-400/20 mb-5">
            {(['pay', 'install'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                  tab === t
                    ? 'bg-amber-400 text-slate-900'
                    : 'text-amber-300 hover:bg-slate-800'
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
                <p className="text-lg font-bold text-emerald-300">Tip sent!</p>
                <p className="text-sm text-gray-300 mt-1">Thank you for supporting @{creatorHandle}.</p>
                {onClose && (
                  <button onClick={onClose} className="mt-4 px-5 py-2 rounded-xl bg-amber-400 text-slate-900 font-bold text-sm">
                    Close
                  </button>
                )}
              </div>
            ) : payStatus === 'error' ? (
              <div className="text-center py-4">
                <p className="text-red-400 text-sm mb-3">{payError}</p>
                <button onClick={() => { setPayStatus('waiting'); setPayError('') }} className="text-xs text-amber-300 underline">
                  Try again
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center gap-3 mb-4">
                  {payQr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={payQr} alt="Scan to pay with Nimiq Pay" className="rounded-xl bg-white p-2" width={240} height={240} />
                  ) : (
                    <div className="w-[240px] h-[240px] rounded-xl bg-slate-700/40 animate-pulse" />
                  )}
                  <p className="text-xs text-gray-300 text-center">
                    Open Nimiq Pay → tap the scanner → scan this code to send {amountNIM} NIM directly.
                  </p>
                </div>
                {(payStatus === 'waiting') && (
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-4">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Waiting for payment…
                  </div>
                )}
                {payStatus === 'submitting' && (
                  <div className="flex items-center justify-center gap-2 text-xs text-emerald-300 mb-4">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Payment detected — recording…
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <a href={NIMIQ_PAY_IOS_URL} target="_blank" rel="noopener noreferrer"
                    className="text-center py-2.5 rounded-xl border-2 border-amber-400/20 bg-slate-800/50 text-amber-300 text-sm font-semibold hover:border-amber-400/40 transition-all">
                     App Store
                  </a>
                  <a href={NIMIQ_PAY_ANDROID_URL} target="_blank" rel="noopener noreferrer"
                    className="text-center py-2.5 rounded-xl border-2 border-amber-400/20 bg-slate-800/50 text-amber-300 text-sm font-semibold hover:border-amber-400/40 transition-all">
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
            <p className="text-xs text-gray-400 text-center mb-4">
              To send NIM tips, open this wall in Nimiq Pay.
            </p>
            {mobile ? (
              <a href={deepLink}
                className="block w-full text-center py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-bold rounded-xl shadow-lg hover:shadow-xl hover:from-amber-500 hover:to-amber-600 transition-all duration-300 mb-3">
                ⚡ Open in Nimiq Pay
              </a>
            ) : (
              <div className="flex flex-col items-center gap-3 mb-4">
                {installQr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={installQr} alt="Scan to open in Nimiq Pay" className="rounded-xl bg-white p-2 max-w-full h-auto" width={220} height={220} />
                ) : (
                  <div className="w-[220px] h-[220px] rounded-xl bg-slate-700/40 animate-pulse" />
                )}
                <p className="text-xs text-gray-300 text-center">
                  Scan with your phone to open this wall inside Nimiq Pay
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-5">
              <a href={NIMIQ_PAY_IOS_URL} target="_blank" rel="noopener noreferrer"
                className="text-center py-2.5 rounded-xl border-2 border-amber-400/20 bg-slate-800/50 text-amber-300 text-sm font-semibold hover:border-amber-400/40 hover:bg-slate-800 transition-all">
                 App Store
              </a>
              <a href={NIMIQ_PAY_ANDROID_URL} target="_blank" rel="noopener noreferrer"
                className="text-center py-2.5 rounded-xl border-2 border-amber-400/20 bg-slate-800/50 text-amber-300 text-sm font-semibold hover:border-amber-400/40 hover:bg-slate-800 transition-all">
                ▶ Google Play
              </a>
            </div>

            {amountNIM && (
              <div className="mb-5">
                {pledgeUrl ? (
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3">
                    <p className="text-sm text-emerald-200 font-semibold mb-1">Your support has been reserved.</p>
                    <p className="text-[11px] text-gray-300 mb-2">Open this link in Nimiq Pay anytime to finish.</p>
                    <div className="flex items-center gap-2">
                      <input readOnly value={pledgeUrl} className="flex-1 bg-slate-900 rounded-lg px-3 py-2 text-xs text-gray-200 font-mono truncate" />
                      <button type="button" onClick={copyPledge} className="shrink-0 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold transition-colors">
                        {copied ? '✓' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={createPledge} disabled={pledging}
                    className="w-full py-2.5 rounded-xl border border-slate-600 text-slate-200 text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-60">
                    {pledging ? 'Reserving…' : 'Support Later — get a claim link'}
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <a href={NIMIQ_PAY_LANDING_URL} target="_blank" rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-amber-300 underline underline-offset-4 transition-colors">
                Learn more
              </a>
              {onClose && (
                <button onClick={onClose} className="text-xs text-slate-400 hover:text-white transition-colors">
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
