'use client'
import { NIMIQ_PAY_IOS_URL, NIMIQ_PAY_ANDROID_URL } from '@/lib/nimiq-pay'

const deepLink = (url: string) => `nimiqpay://miniapp?url=${encodeURIComponent(url)}`

export default function InstallNimiqPrompt({ url, onDismiss }: { url: string; onDismiss?: () => void }) {
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
  const isMobile = isIOS || isAndroid
  const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(deepLink(url))}`

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border-2 border-amber-400/20">
        <div className="text-center space-y-5">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">
            Open in Nimiq Pay
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            TipWall runs inside the Nimiq Pay app to give you secure access to your wallet for tipping and profile creation.
          </p>

          {isMobile ? (
            <div className="space-y-4">
              <button
                onClick={() => { window.location.href = deepLink(url) }}
                className="w-full py-4 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all text-base"
              >
                ⚡ Open in Nimiq Pay
              </button>
              <StoreFallback isIOS={isIOS} />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">Scan this QR code with your phone:</p>
              <div className="flex justify-center">
                <img
                  src={qrLink}
                  alt="QR code to open TipWall in Nimiq Pay"
                  className="rounded-2xl border-2 border-amber-400/20"
                />
              </div>
              <a
                href={deepLink(url)}
                className="text-xs text-amber-300 break-all hover:underline"
              >
                {deepLink(url)}
              </a>
            </div>
          )}

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors pt-2"
            >
              Continue as guest (view only)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StoreFallback({ isIOS }: { isIOS: boolean }) {
  return (
    <div className="space-y-2 pt-3 border-t border-gray-700">
      <p className="text-xs text-gray-400">Don&apos;t have Nimiq Pay yet?</p>
      <a
        href={isIOS ? NIMIQ_PAY_IOS_URL : NIMIQ_PAY_ANDROID_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full py-3 bg-slate-700 text-white font-semibold rounded-xl text-center text-sm hover:bg-slate-600 transition-colors"
      >
        {isIOS ? '📱 Download on App Store' : '📱 Get it on Google Play'}
      </a>
    </div>
  )
}
