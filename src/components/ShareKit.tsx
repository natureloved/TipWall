'use client'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { creatorShareText, openShare, canNativeShare, envWallUrl, type ShareChannel } from '@/lib/share'
import { track } from '@/lib/analytics'
import { useTranslations } from '@/lib/i18n'
import { escapeHtml } from '@/lib/html'

/**
 * The creator's Share Kit: everything needed to put a wall where their
 * audience already is - copyable link, a pre-written post with one-tap share
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
  const t = useTranslations()
  const [origin, setOrigin] = useState('')
  const [postText, setPostText] = useState(() => creatorShareText(t('shareDefaultText')))
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [nativeShare, setNativeShare] = useState(false)

  // `origin` is resolved from the browser after mount (see effect below). Until
  // then we must render the SAME value the server did, so both the server and
  // the first client render use the env-derived fallback. Deriving from
  // `window` before `origin` is set would make the first client render disagree
  // with the server HTML → hydration mismatch.
  const url = origin ? `${origin}/${handle}` : envWallUrl(handle)
  const overlayUrl = `${url}/overlay`
  const badgeUrl = `${origin}/api/badge/${handle}?v=2`
  const badgeMarkdown = `[![Tip me on TipWall](${badgeUrl})](${url})`
  const embedName = displayName?.trim() || `@${handle}`
  const embedHtml = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(`⚡ Tip ${embedName} in NIM on TipWall`)}</a>`
  const fabScript = `<script src="${escapeHtml(`${origin}/embed/${handle}`)}" defer></script>`

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
    QRCode.toDataURL(url, { width: 240, margin: 1, color: { dark: '#171614', light: '#fffdf7' } })
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
      const png = await QRCode.toDataURL(url, { width: 1024, margin: 2, color: { dark: '#171614', light: '#fffdf7' } })
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
    <div className="mx-auto w-full max-w-xl space-y-5 text-[#171614]">
      {/* Header */}
      <div className="text-center">
        {isNew ? (
          <>
            <div className="text-4xl mb-2">🎉</div>
            <h1 className="text-2xl font-bold text-[#171614]">{t('shareLiveTitle')}</h1>
            <p className="mt-2 text-sm text-[#5f574b]">
              {t('shareLiveBody')}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-[#171614]">{t('shareTitle', { handle })}</h1>
            <p className="mt-2 text-sm text-[#5f574b]">
              {t('shareBody')}
            </p>
          </>
        )}
      </div>

      {/* 1. Wall link */}
      <section className="rounded-2xl border border-[#171614]/25 bg-[#fffdf7] p-5 shadow-[3px_3px_0_rgba(23,22,20,0.10)]">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#b9382a]">{t('yourWallLink')}</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input readOnly value={url} className="flex-1 truncate rounded-lg border border-[#92897b] bg-[#f4f0e6] px-3 py-2.5 font-mono text-sm text-[#171614] focus:border-[#b9382a] focus:outline-none focus:ring-2 focus:ring-[#f05a3c]/25" />
          <button
            type="button"
            onClick={() => copy('url', url)}
            className="w-full shrink-0 rounded-lg border border-[#171614] bg-[#f05a3c] px-4 py-2.5 text-sm font-bold text-[#171614] transition-colors hover:bg-[#ff7358] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171614] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf7] sm:w-auto"
          >
            {copied === 'url' ? `✓ ${t('copied')}` : t('shareCopy')}
          </button>
        </div>
      </section>

      {/* 2. Pre-written post + one-tap shares */}
      <section className="rounded-2xl border border-[#171614]/25 bg-[#fffdf7] p-5 shadow-[3px_3px_0_rgba(23,22,20,0.10)]">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#b9382a]">{t('announceIt')}</h2>
        <textarea
          value={postText}
          onChange={e => setPostText(e.target.value)}
          rows={3}
          className="mb-3 w-full resize-none rounded-lg border border-[#92897b] bg-[#f4f0e6] px-3 py-2.5 text-sm text-[#171614] focus:border-[#b9382a] focus:outline-none focus:ring-2 focus:ring-[#f05a3c]/25"
          aria-label="Share post text"
        />
        <div className="flex flex-wrap gap-2">
          <ShareBtn label={t('sharePostX')} onClick={() => share('x')} />
          <ShareBtn label={t('shareTelegram')} onClick={() => share('telegram')} />
          <ShareBtn label={t('shareWhatsapp')} onClick={() => share('whatsapp')} />
          {nativeShare && <ShareBtn label={t('shareMore')} onClick={() => share('native')} />}
          <ShareBtn label={copied === 'post' ? `✓ ${t('copied')}` : t('shareCopyText')} onClick={() => copy('post', `${postText} ${url}`)} />
        </div>
      </section>

      {/* 3. QR code + poster (streams, slides, print) */}
      <section className="rounded-2xl border border-[#171614]/25 bg-[#fffdf7] p-5 shadow-[3px_3px_0_rgba(23,22,20,0.10)]">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#b9382a]">{t('qrCode')}</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL QR code; nothing to optimize
            <img src={qrDataUrl} alt={`QR code linking to ${url}`} className="rounded-xl border border-[#171614]/20 bg-[#fffdf7] p-2" width={160} height={160} />
          ) : (
            <div className="h-[160px] w-[160px] animate-pulse rounded-xl bg-[#e9e2d2]" />
          )}
          <div className="flex-1 space-y-2 w-full">
            <p className="text-xs text-[#746b5e]">
              {t('shareQrBody')}
            </p>
            <button type="button" onClick={downloadQr} className="w-full rounded-lg border border-[#171614]/35 bg-[#fffdf7] py-2.5 text-sm font-semibold text-[#171614] transition-colors hover:border-[#b9382a] hover:bg-[#fff1eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9382a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf7]">
              {t('downloadQr')}
            </button>
            <button type="button" onClick={downloadPoster} className="w-full rounded-lg border border-[#171614]/35 bg-[#fffdf7] py-2.5 text-sm font-semibold text-[#171614] transition-colors hover:border-[#b9382a] hover:bg-[#fff1eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9382a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf7]">
              {t('downloadPoster')}
            </button>
          </div>
        </div>
      </section>

      {/* 4. Stream overlay */}
      <section className="rounded-2xl border border-[#171614]/25 bg-[#fffdf7] p-5 shadow-[3px_3px_0_rgba(23,22,20,0.10)]">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#b9382a]">{t('streamOverlay')}</h2>
        <p className="mb-3 text-xs leading-relaxed text-[#746b5e]">
          {t('shareOverlayBody')}
        </p>
        <CodeSnippet value={overlayUrl} copied={copied === 'overlay'} onCopy={() => copy('overlay', overlayUrl)} />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#5f574b]">
          <span>{t('shareObs')}</span>
          <a href={`/${handle}/overlay?preview=1`} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#b9382a] underline underline-offset-4 hover:text-[#171614]">
            {t('previewOverlay')}
          </a>
        </div>
      </section>

      {/* 5. GitHub badge */}
      <section className="rounded-2xl border border-[#171614]/25 bg-[#fffdf7] p-5 shadow-[3px_3px_0_rgba(23,22,20,0.10)]">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#b9382a]">{t('githubBadge')}</h2>
        {origin && (
          <div className="mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- same-origin dynamic SVG badge */}
            <img src={badgeUrl} alt={`TipWall badge for @${handle}`} height={20} />
          </div>
        )}
        <p className="mb-2 text-xs text-[#746b5e]">
          {t('shareBadgeBody')}
        </p>
        <CodeSnippet value={badgeMarkdown} copied={copied === 'badge'} onCopy={() => copy('badge', badgeMarkdown)} />
      </section>

      {/* 6. Embed / link-in-bio */}
      <section className="rounded-2xl border border-[#171614]/25 bg-[#fffdf7] p-5 shadow-[3px_3px_0_rgba(23,22,20,0.10)]">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#b9382a]">{t('embedTitle')}</h2>
        <p className="mb-2 text-xs text-[#746b5e]">
          {t('shareEmbedBody')}
        </p>
        <CodeSnippet value={embedHtml} copied={copied === 'embed'} onCopy={() => copy('embed', embedHtml)} />
      </section>

      {/* 7. Floating tip button for own sites */}
      <section className="rounded-2xl border border-[#171614]/25 bg-[#fffdf7] p-5 shadow-[3px_3px_0_rgba(23,22,20,0.10)]">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#b9382a]">{t('floatingButton')}</h2>
        <p className="mb-2 text-xs text-[#746b5e]">
          {t('shareFloatingBody')}
        </p>
        <CodeSnippet value={fabScript} copied={copied === 'fab'} onCopy={() => copy('fab', fabScript)} />
      </section>

      {/* 8. Creator-owned history */}
      <section className="rounded-2xl border border-[#7d9b85] bg-[#e7f0e7] p-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#315c3b]">{t('ownHistory')}</h2>
        <p className="mb-3 text-xs leading-relaxed text-[#425b49]">
          {t('shareHistoryBody')}
        </p>
        <a
          href={`/${handle}/dashboard`}
          className="inline-block rounded-lg border border-[#315c3b] bg-[#fffdf7] px-3 py-2 text-xs font-bold text-[#315c3b] transition-colors hover:bg-[#d5e7d8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315c3b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#e7f0e7]"
        >
          {t('openDashboardExport')}
        </a>
      </section>

      <div className="flex items-center justify-center gap-4 pb-8 text-xs text-[#746b5e]">
        <a href={`/${handle}`} className="font-semibold text-[#b9382a] underline underline-offset-4 transition-colors hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9382a]">
          {isNew ? t('goToWall') : t('viewWall')}
        </a>
        <a href={`/${handle}/dashboard`} className="font-semibold text-[#b9382a] underline underline-offset-4 transition-colors hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9382a]">
          {t('dashboard')}
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
      className="rounded-lg border border-[#b9382a]/55 bg-[#fff1eb] px-4 py-2 text-sm font-semibold text-[#9d3025] transition-colors hover:border-[#b9382a] hover:bg-[#ffe0d6] hover:text-[#171614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9382a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf7]"
    >
      {label}
    </button>
  )
}

function CodeSnippet({ value, copied, onCopy }: { value: string; copied: boolean; onCopy: () => void }) {
  const t = useTranslations()
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2">
      <code className="block flex-1 break-all rounded-lg border border-[#92897b] bg-[#f4f0e6] px-3 py-2.5 font-mono text-[11px] text-[#403b34]">
        {value}
      </code>
      <button
        type="button"
        onClick={onCopy}
        className="w-full shrink-0 rounded-lg border border-[#171614] bg-[#171614] px-3 py-2 text-xs font-semibold text-[#fffdf7] transition-colors hover:bg-[#39342d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9382a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf7] sm:w-auto"
      >
        {copied ? '✓' : t('copy')}
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

  // Warm editorial background
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#f4f0e6')
  bg.addColorStop(0.6, '#fffaf0')
  bg.addColorStop(1, '#e9e2d2')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'center'

  // Brand
  ctx.fillStyle = '#b9382a'
  ctx.font = 'bold 44px sans-serif'
  ctx.fillText('⚡ TipWall', W / 2, 110)

  // Creator name (shrink to fit)
  ctx.fillStyle = '#171614'
  let nameSize = 72
  ctx.font = `bold ${nameSize}px sans-serif`
  while (ctx.measureText(displayName).width > W - 120 && nameSize > 36) {
    nameSize -= 4
    ctx.font = `bold ${nameSize}px sans-serif`
  }
  ctx.fillText(displayName, W / 2, 230)

  ctx.fillStyle = '#5f574b'
  ctx.font = '36px sans-serif'
  ctx.fillText('Scan to tip me in NIM', W / 2, 300)

  // QR on a white rounded card
  const qrSize = 620
  const cardPad = 40
  const cardX = (W - qrSize) / 2 - cardPad
  const cardY = 370
  const cardSize = qrSize + cardPad * 2
  ctx.fillStyle = '#fffdf7'
  roundRect(ctx, cardX, cardY, cardSize, cardSize, 32)
  ctx.fill()
  ctx.strokeStyle = '#171614'
  ctx.lineWidth = 4
  ctx.stroke()

  const qrPng = await QRCode.toDataURL(url, { width: qrSize, margin: 0, color: { dark: '#171614', light: '#fffdf7' } })
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
  ctx.fillStyle = '#b9382a'
  ctx.font = 'bold 40px monospace'
  ctx.fillText(url.replace(/^https?:\/\//, ''), W / 2, cardY + cardSize + 90)
  ctx.fillStyle = '#5f574b'
  ctx.font = '30px sans-serif'
  ctx.fillText('Tip the person or project. Not the platform.', W / 2, cardY + cardSize + 150)

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
