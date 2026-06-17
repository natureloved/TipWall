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

  if (loading) return <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 animate-pulse"><div className="h-3 bg-slate-200 rounded w-3/4" /><div className="h-3 bg-slate-100 rounded w-1/2 mt-2" /></div>
  if (!meta) return <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 text-sm text-yellow-700 truncate block">{url}</a>

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-white overflow-hidden shadow-sm ring-1 ring-slate-200 block">
      {meta.image && <img src={meta.image} alt={meta.title || ''} className="w-full h-32 object-cover" />}
      <div className="p-4">
        <p className="text-xs text-gray-500 mb-1">{meta.siteName || (() => { try { return new URL(url).hostname.replace('www.', '') } catch { return url } })()}</p>
        <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2">{meta.title || url}</p>
        {meta.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{meta.description}</p>}
        {meta.stars !== undefined && <p className="text-xs text-gray-400 mt-1.5">⭐ {meta.stars.toLocaleString()} star{meta.stars === 1 ? '' : 's'}</p>}
      </div>
    </a>
  )
}
