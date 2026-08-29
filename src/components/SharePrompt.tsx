'use client'
import { useEffect, useState } from 'react'
import { supporterShareText, openShare, canNativeShare, type ShareChannel } from '@/lib/share'

/**
 * Post-tip supporter share prompt. A supporter announcing "I just tipped X" is
 * more credible distribution than the creator asking - so the moment right
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
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-4 pointer-events-none">
      <div
        role="dialog"
        aria-label="Share your support"
        className="pointer-events-auto mx-auto w-full max-w-md animate-slide-up rounded-2xl border-2 border-[#3f6f4d] bg-[#fffaf0] p-4 text-[#171614] shadow-[0_18px_48px_rgba(23,22,20,0.24)] sm:p-5"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-bold text-[#315c3b]">💚 Thanks for supporting @{handle}!</p>
            <p className="mt-1 text-xs text-[#5f574b]">
              Tell others. Supporters like you are how creators get found.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-lg leading-none text-[#746b5e] transition-colors hover:bg-[#e7f0e7] hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315c3b]"
          >
            ×
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
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
      className="rounded-lg border border-[#3f6f4d]/55 bg-[#e7f0e7] px-3.5 py-2 text-xs font-semibold text-[#315c3b] transition-colors hover:border-[#315c3b] hover:bg-[#d5e7d8] hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315c3b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0]"
    >
      {label}
    </button>
  )
}
