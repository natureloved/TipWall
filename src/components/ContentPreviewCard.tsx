'use client'
import { useEffect, useState } from 'react'
import { OGMetadata } from '@/lib/types'

function displayUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    const compact = `${host}${path}`
    return compact.length > 72 ? `${compact.slice(0, 69)}...` : compact
  } catch {
    return url.length > 72 ? `${url.slice(0, 69)}...` : url
  }
}

export default function ContentPreviewCard({ url, handle }: { url: string; handle: string }) {
  const [meta, setMeta] = useState<OGMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const compactUrl = displayUrl(url)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // The server resolves the URL from the profile itself (anti-SSRF).
        const res = await fetch(`/api/og?handle=${encodeURIComponent(handle)}`)
        const json = res.ok ? await res.json() : null
        if (!cancelled) setMeta(json)
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [handle, url])

  if (loading) return (
    <div className="rounded-2xl bg-white p-5 shadow-lg border-2 border-amber-400/10 animate-pulse" style={{animationDelay: '0.25s'}} role="status" aria-busy="true" aria-label="Loading featured work">
      <div className="h-44 bg-gradient-to-br from-gray-200 to-gray-100 rounded-lg mb-4" />
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
      <div className="h-5 bg-gray-300 rounded w-2/3 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-full" />
    </div>
  )
  
  if (!meta) return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open featured work: ${compactUrl}`}
      className="surface creator-featured-work flex items-center gap-4 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all border-2 border-amber-400/10 hover:border-amber-400/30 animate-slide-up"
      style={{animationDelay: '0.25s'}}
    >
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#b9382a]/35 bg-[#fff3ee] text-lg text-[#b9382a]">↗</span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-wide text-[#b9382a]">Featured work</span>
        <span className="mt-1 block truncate text-sm font-semibold text-[#171614]">{compactUrl}</span>
      </span>
    </a>
  )

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open featured work: ${meta.title || compactUrl}`}
      className="surface creator-featured-work overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all border-2 border-amber-400/10 hover:border-amber-400/30 block animate-slide-up"
      style={{animationDelay: '0.25s'}}
    >
      {meta.image && (
        <div className="relative w-full h-44 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50">
          {/* Plain <img>: the preview image is an arbitrary external URL, and
              routing it through the Next image optimizer would let anyone use
              our deployment to proxy/resize any image on the internet. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={meta.image}
            alt={meta.title || ''}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      )}
      <div className="p-5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#b9382a]">Featured work</p>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#746b5e]">
          {meta.siteName || (() => {
            try {
              return new URL(url).hostname.replace('www.', '')
            } catch {
              return compactUrl
            }
          })()}
        </p>
        <p className="text-lg font-bold text-gray-900 leading-snug line-clamp-2 mb-2">
          {meta.title || compactUrl}
        </p>
        {meta.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{meta.description}</p>
        )}
        {meta.stars !== undefined && (
          <p className="text-xs text-gray-500 mt-3 font-semibold">⭐ {meta.stars.toLocaleString()} star{meta.stars === 1 ? '' : 's'}</p>
        )}
      </div>
    </a>
  )
}
