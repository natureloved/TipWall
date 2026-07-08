import { NextRequest, NextResponse } from 'next/server'
import { getOgMetadata, getProfile, checkRateLimit } from '@/lib/kv'
import { normalizeHandle } from '@/lib/profile-auth'

/**
 * Fetch OG metadata for a creator's content link. Scoped by handle — the server
 * only ever fetches the URL stored on that profile, so this endpoint can't be
 * used as an open fetch proxy or to bloat the KV cache with arbitrary URLs.
 */
export async function GET(request: NextRequest) {
  const handle = normalizeHandle(request.nextUrl.searchParams.get('handle') || '')
  if (!handle) return NextResponse.json({ error: 'handle required' }, { status: 400 })

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = (forwarded ? forwarded.split(',')[0].trim() : '') || 'unknown'
  const withinLimit = await checkRateLimit(`og:${ip}`, 30, 60000)
  if (!withinLimit) return NextResponse.json({ error: 'rate limited' }, { status: 429 })

  const profile = await getProfile(handle)
  if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (!profile.contentUrl) return NextResponse.json({ error: 'no content url' }, { status: 404 })

  const meta = await getOgMetadata(profile.contentUrl)
  if (!meta) return NextResponse.json({ error: 'failed to fetch' }, { status: 502 })
  return NextResponse.json(meta)
}
