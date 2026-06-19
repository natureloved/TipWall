'use client'
import { useEffect, useState } from 'react'
import { OGMetadata } from '@/lib/types'

export default function ContentPreviewCard({ url }: { url: string }) {
  const [meta, setMeta] = useState<OGMetadata | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`)
        const json = await res.json()
        setMeta(json)
      } catch {}
      setLoading(false)
    })()
  }, [url])

  if (loading) return (
    <div className="rounded-2xl bg-white p-6 shadow-lg border-2 border-amber-400/10 animate-pulse" style={{animationDelay: '0.75s'}}>
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
      className="rounded-2xl bg-white p-6 shadow-lg hover:shadow-xl transition-all border-2 border-amber-400/10 hover:border-amber-400/30 text-sm text-amber-700 truncate block font-semibold animate-slide-up"
      style={{animationDelay: '0.75s'}}
    >
      {url}
    </a>
  )

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-2xl bg-white overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all border-2 border-amber-400/10 hover:border-amber-400/30 block animate-slide-up"
      style={{animationDelay: '0.75s'}}
    >
      {meta.image && (
        <div className="relative w-full h-44 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50">
          <img
            src={meta.image}
            alt={meta.title || ''}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      )}
      <div className="p-5">
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">
          {meta.siteName || (() => {
            try {
              return new URL(url).hostname.replace('www.', '')
            } catch {
              return url
            }
          })()}
        </p>
        <p className="text-lg font-bold text-gray-900 leading-snug line-clamp-2 mb-2">
          {meta.title || url}
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
