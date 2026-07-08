'use client'
import { useEffect, useState } from 'react'
import { supporterShareText, openShare, canNativeShare, type ShareChannel } from '@/lib/share'

/**
 * Post-tip supporter share prompt. A supporter announcing "I just tipped X" is
 * more credible distribution than the creator asking — so the moment right
 * after a successful tip gets its own gentle, dismissable prompt.
 */
export default function SharePrompt({ handle, amountNIM, onClose }: {
  handle: string
  amountNIM?: number
  onClose: () => void
}) {
  const [nativeShare, setNativeShare] = useState(false)
  const [copied, setCopied] = useState(false)

  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/${handle}`
  const text = supporterShareText(handle, amountNIM)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setNativeShare(canNativeShare()))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const share = (channel: ShareChannel) => {
    openShare(channel, handle, text, url)
    if (channel !== 'copy') onClose()
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      openShare('copy', handle, text, url)
      setCopied(true)
      setTimeout(onClose, 1200)
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 pointer-events-none">
      <div
        role="dialog"
        aria-label="Share your support"
        className="pointer-events-auto mx-auto max-w-md rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-emerald-400/30 p-5 shadow-2xl animate-slide-up"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-bold text-emerald-300">💚 Thanks for supporting @{handle}!</p>
            <p className="text-xs text-gray-300 mt-1">
              Tell others — supporters like you are how creators get found.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss"
            className="shrink-0 text-slate-400 hover:text-white text-lg leading-none transition-colors"
          >
            ×
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <PromptBtn label="Post on X" onClick={() => share('x')} />
          <PromptBtn label="Telegram" onClick={() => share('telegram')} />
          <PromptBtn label="WhatsApp" onClick={() => share('whatsapp')} />
          {nativeShare && <PromptBtn label="More…" onClick={() => share('native')} />}
          <PromptBtn label={copied ? '✓ Copied' : 'Copy'} onClick={copyText} />
        </div>
      </div>
    </div>
  )
}

function PromptBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3.5 py-2 rounded-lg border border-emerald-400/30 bg-slate-900 text-emerald-300 text-xs font-semibold hover:border-emerald-400/60 hover:bg-slate-900/60 transition-colors"
    >
      {label}
    </button>
  )
}
