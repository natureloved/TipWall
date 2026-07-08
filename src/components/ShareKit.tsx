'use client'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { creatorShareText, openShare, canNativeShare, wallUrl, type ShareChannel } from '@/lib/share'
import { track } from '@/lib/analytics'

/**
 * The creator's Share Kit: everything needed to put a wall where their
 * audience already is — copyable link, a pre-written post with one-tap share
 * buttons, a QR code (+ downloadable poster), a live GitHub badge snippet,
 * and an HTML embed for blogs / link-in-bio pages.
 *
 * Shown right after profile creation (`isNew`), when sharing intent peaks,
 * and reachable any time from the wall and dashboard.
 */
export default function ShareKit({ handle, displayName, isNew = false }: {
  handle: string
  displayName?: string
  isNew?: boolean
}) {
  const [origin, setOrigin] = useState('')
  const [postText, setPostText] = useState(creatorShareText())
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [nativeShare, setNativeShare] = useState(false)

  const url = origin ? `${origin}/${handle}` : wallUrl(handle)
  const badgeUrl = `${origin}/api/badge/${handle}`
  const badgeMarkdown = `[![Tip me on TipWall](${badgeUrl})](${url})`
  const embedHtml = `<a href="${url}" target="_blank" rel="noopener">⚡ Tip ${displayName || `@${handle}`} in NIM on TipWall</a>`

  useEffect(() => {
    // Origin and Web Share availability are browser-only; resolve after mount.
    const raf = requestAnimationFrame(() => {
      setOrigin(window.location.origin)
      setNativeShare(canNativeShare())
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (!url) return
    QRCode.toDataURL(url, { width: 240, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''))
  }, [url])

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      track(handle, 'WALL_SHARED')
      setTimeout(() => setCopied(c => (c === key ? null : c)), 2000)
    } catch { /* clipboard unavailable */ }
  }

  const share = (channel: ShareChannel) => openShare(channel, handle, postText, url)

  const downloadQr = async () => {
    try {
      const png = await QRCode.toDataURL(url, { width: 1024, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      triggerDownload(png, `tipwall-${handle}-qr.png`)
      track(handle, 'WALL_SHARED')
    } catch { /* ignore */ }
  }

  const downloadPoster = async () => {
    try {
      const png = await renderPoster(handle, displayName || `@${handle}`, url)
      triggerDownload(png, `tipwall-${handle}-poster.png`)
      track(handle, 'WALL_SHARED')
    } catch { /* ignore */ }
  }

  return (
    <div className="w-full max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div className="text-center">
        {isNew ? (
          <>
            <div className="text-4xl mb-2">🎉</div>
            <h1 className="text-2xl font-bold text-white">Your TipWall is live!</h1>
            <p className="text-sm text-slate-400 mt-2">
              A wall only earns when your audience can find it. Put it where they already are — takes one minute.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white">Share @{handle}</h1>
            <p className="text-sm text-slate-400 mt-2">
              Everything you need to put your wall in front of your audience.
            </p>
          </>
        )}
      </div>

      {/* 1. Wall link */}
      <section className="rounded-2xl bg-slate-800 p-5">
        <h2 className="text-xs font-bold text-amber-300 uppercase tracking-widest mb-3">Your wall link</h2>
        <div className="flex items-center gap-2">
          <input readOnly value={url} className="flex-1 bg-slate-900 rounded-lg px-3 py-2.5 text-sm text-gray-200 font-mono truncate" />
          <button
            type="button"
            onClick={() => copy('url', url)}
            className="shrink-0 px-4 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-900 text-sm font-bold transition-colors"
          >
            {copied === 'url' ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </section>

      {/* 2. Pre-written post + one-tap shares */}
      <section className="rounded-2xl bg-slate-800 p-5">
        <h2 className="text-xs font-bold text-amber-300 uppercase tracking-widest mb-3">Announce it</h2>
        <textarea
          value={postText}
          onChange={e => setPostText(e.target.value)}
          rows={3}
          className="w-full bg-slate-900 rounded-lg px-3 py-2.5 text-sm text-gray-200 mb-3 resize-none"
          aria-label="Share post text"
        />
        <div className="flex flex-wrap gap-2">
          <ShareBtn label="Post on X" onClick={() => share('x')} />
          <ShareBtn label="Telegram" onClick={() => share('telegram')} />
          <ShareBtn label="WhatsApp" onClick={() => share('whatsapp')} />
          {nativeShare && <ShareBtn label="More…" onClick={() => share('native')} />}
          <ShareBtn label={copied === 'post' ? '✓ Copied' : 'Copy text'} onClick={() => copy('post', `${postText} ${url}`)} />
        </div>
      </section>

      {/* 3. QR code + poster (streams, slides, print) */}
      <section className="rounded-2xl bg-slate-800 p-5">
        <h2 className="text-xs font-bold text-amber-300 uppercase tracking-widest mb-3">QR code</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL QR code; nothing to optimize
            <img src={qrDataUrl} alt={`QR code linking to ${url}`} className="rounded-xl bg-white p-2" width={160} height={160} />
          ) : (
            <div className="w-[160px] h-[160px] rounded-xl bg-slate-700/40 animate-pulse" />
          )}
          <div className="flex-1 space-y-2 w-full">
            <p className="text-xs text-slate-400">
              For stream overlays, slide decks, video outros, or the coffee-shop counter.
            </p>
            <button type="button" onClick={downloadQr} className="w-full py-2.5 rounded-lg border border-slate-600 text-slate-200 text-sm font-semibold hover:bg-slate-700 transition-colors">
              Download QR (PNG)
            </button>
            <button type="button" onClick={downloadPoster} className="w-full py-2.5 rounded-lg border border-slate-600 text-slate-200 text-sm font-semibold hover:bg-slate-700 transition-colors">
              Download poster (PNG)
            </button>
          </div>
        </div>
      </section>

      {/* 4. GitHub badge */}
      <section className="rounded-2xl bg-slate-800 p-5">
        <h2 className="text-xs font-bold text-amber-300 uppercase tracking-widest mb-3">GitHub README badge</h2>
        {origin && (
          <div className="mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- same-origin dynamic SVG badge */}
            <img src={badgeUrl} alt={`TipWall badge for @${handle}`} height={20} />
          </div>
        )}
        <p className="text-xs text-slate-400 mb-2">
          Shows your live NIM total. Paste into any README or markdown file:
        </p>
        <CodeSnippet value={badgeMarkdown} copied={copied === 'badge'} onCopy={() => copy('badge', badgeMarkdown)} />
      </section>

      {/* 5. Embed / link-in-bio */}
      <section className="rounded-2xl bg-slate-800 p-5">
        <h2 className="text-xs font-bold text-amber-300 uppercase tracking-widest mb-3">Blog / link-in-bio embed</h2>
        <p className="text-xs text-slate-400 mb-2">
          For blog posts, YouTube descriptions, and link-in-bio pages:
        </p>
        <CodeSnippet value={embedHtml} copied={copied === 'embed'} onCopy={() => copy('embed', embedHtml)} />
      </section>

      <div className="flex items-center justify-center gap-4 text-xs text-slate-400 pb-8">
        <a href={`/${handle}`} className="underline underline-offset-4 hover:text-amber-300 transition-colors">
          {isNew ? 'Go to my wall →' : 'View wall'}
        </a>
        <a href={`/${handle}/dashboard`} className="underline underline-offset-4 hover:text-amber-300 transition-colors">
          Dashboard
        </a>
      </div>
    </div>
  )
}

function ShareBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 rounded-lg border border-amber-400/30 bg-slate-900 text-amber-300 text-sm font-semibold hover:border-amber-400/60 hover:bg-slate-900/60 transition-colors"
    >
      {label}
    </button>
  )
}

function CodeSnippet({ value, copied, onCopy }: { value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <code className="flex-1 block bg-slate-900 rounded-lg px-3 py-2.5 text-[11px] text-gray-300 font-mono break-all">
        {value}
      </code>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-white transition-colors"
      >
        {copied ? '✓' : 'Copy'}
      </button>
    </div>
  )
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

/** Render a printable 1080x1350 poster (title, QR, URL) to a PNG data URL. */
async function renderPoster(handle: string, displayName: string, url: string): Promise<string> {
  const W = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#0f172a')
  bg.addColorStop(0.6, '#1e293b')
  bg.addColorStop(1, '#0f172a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'center'

  // Brand
  ctx.fillStyle = '#fbbf24'
  ctx.font = 'bold 44px sans-serif'
  ctx.fillText('⚡ TipWall', W / 2, 110)

  // Creator name (shrink to fit)
  ctx.fillStyle = '#fde68a'
  let nameSize = 72
  ctx.font = `bold ${nameSize}px sans-serif`
  while (ctx.measureText(displayName).width > W - 120 && nameSize > 36) {
    nameSize -= 4
    ctx.font = `bold ${nameSize}px sans-serif`
  }
  ctx.fillText(displayName, W / 2, 230)

  ctx.fillStyle = '#cbd5e1'
  ctx.font = '36px sans-serif'
  ctx.fillText('Scan to tip me in NIM', W / 2, 300)

  // QR on a white rounded card
  const qrSize = 620
  const cardPad = 40
  const cardX = (W - qrSize) / 2 - cardPad
  const cardY = 370
  const cardSize = qrSize + cardPad * 2
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, cardX, cardY, cardSize, cardSize, 32)
  ctx.fill()

  const qrPng = await QRCode.toDataURL(url, { width: qrSize, margin: 0, color: { dark: '#0f172a', light: '#ffffff' } })
  await new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, (W - qrSize) / 2, cardY + cardPad, qrSize, qrSize)
      resolve()
    }
    img.onerror = () => reject(new Error('QR render failed'))
    img.src = qrPng
  })

  // URL + tagline
  ctx.fillStyle = '#fbbf24'
  ctx.font = 'bold 40px monospace'
  ctx.fillText(url.replace(/^https?:\/\//, ''), W / 2, cardY + cardSize + 90)
  ctx.fillStyle = '#94a3b8'
  ctx.font = '30px sans-serif'
  ctx.fillText('Tip the creator. Not the platform.', W / 2, cardY + cardSize + 150)

  return canvas.toDataURL('image/png')
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
