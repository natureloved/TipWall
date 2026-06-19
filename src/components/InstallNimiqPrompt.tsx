'use client'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import {
  NIMIQ_PAY_IOS_URL,
  NIMIQ_PAY_ANDROID_URL,
  NIMIQ_PAY_LANDING_URL,
  buildNimiqPayDeepLink,
  isMobileDevice,
  wallUrl,
} from '@/lib/environment'

/**
 * Onboarding screen shown when a visitor opens a TipWall outside Nimiq Pay.
 * Goal: preserve their tipping intent and guide them into the Nimiq ecosystem.
 * - Mobile: a one-tap "Open in Nimiq Pay" deep link + store links to install.
 * - Desktop: a QR code that opens this wall directly inside Nimiq Pay.
 */
export default function InstallNimiqPrompt({
  creatorHandle,
  amountNIM,
  onClose,
}: {
  creatorHandle: string
  amountNIM?: number
  onClose?: () => void
}) {
  const [mobile, setMobile] = useState(false)
  const [deepLink, setDeepLink] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    const target = wallUrl(creatorHandle)
    const link = buildNimiqPayDeepLink(target)
    setDeepLink(link)
    setMobile(isMobileDevice())
    QRCode.toDataURL(link, { width: 220, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''))
  }, [creatorHandle])

  const benefits = [
    'Direct creator support',
    'Instant NIM transfers',
    'No platform fees',
    'Secure self-custody wallet',
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto shadow-2xl border-t-2 sm:border-2 border-amber-400/20 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full mx-auto mb-6 sm:hidden" />

        <div className="text-center mb-5">
          <div className="text-4xl mb-2">⚡</div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">
            Support @{creatorHandle}
          </h2>
          <p className="text-sm text-gray-300 mt-2">
            {amountNIM
              ? `Your ${amountNIM} NIM tip is saved — you're one minute away from sending it.`
              : "You're one minute away from supporting this creator."}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            To send NIM tips, open this wall in Nimiq Pay.
          </p>
        </div>

        {/* Primary CTA: mobile deep link, desktop QR */}
        {mobile ? (
          <a
            href={deepLink}
            className="block w-full text-center py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-bold rounded-xl shadow-lg hover:shadow-xl hover:from-amber-500 hover:to-amber-600 transition-all duration-300 mb-3"
          >
            ⚡ Open in Nimiq Pay
          </a>
        ) : (
          <div className="flex flex-col items-center gap-3 mb-4">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Scan to open in Nimiq Pay" className="rounded-xl bg-white p-2 max-w-full h-auto" width={220} height={220} />
            ) : (
              <div className="w-[220px] h-[220px] rounded-xl bg-slate-700/40 animate-pulse" />
            )}
            <p className="text-xs text-gray-300 text-center">
              Scan with your phone to open this wall inside Nimiq Pay
            </p>
          </div>
        )}

        {/* Install links */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <a
            href={NIMIQ_PAY_IOS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center py-2.5 rounded-xl border-2 border-amber-400/20 bg-slate-800/50 text-amber-300 text-sm font-semibold hover:border-amber-400/40 hover:bg-slate-800 transition-all"
          >
             App Store
          </a>
          <a
            href={NIMIQ_PAY_ANDROID_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center py-2.5 rounded-xl border-2 border-amber-400/20 bg-slate-800/50 text-amber-300 text-sm font-semibold hover:border-amber-400/40 hover:bg-slate-800 transition-all"
          >
            ▶ Google Play
          </a>
        </div>

        {/* Benefits */}
        <ul className="space-y-2 mb-5">
          {benefits.map((b) => (
            <li key={b} className="flex items-center gap-2 text-sm text-gray-200">
              <span className="text-emerald-400">✓</span>
              {b}
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-3">
          <a
            href={NIMIQ_PAY_LANDING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-amber-300 underline underline-offset-4 transition-colors"
          >
            Learn more
          </a>
          {onClose && (
            <button onClick={onClose} className="text-xs text-slate-400 hover:text-white transition-colors">
              Maybe later
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
