import type { MetadataRoute } from 'next'
import { kv } from '@vercel/kv'

// Served at /sitemap.xml (matching robots.txt). Must be dynamic: enumerating
// profiles needs KV, which isn't available at build time.
export const dynamic = 'force-dynamic'

const PROFILE_PREFIX = 'tipwall:profile:'
const MAX_ENTRIES = 500

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tipwall.vercel.app'
  const entries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/explore`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
  ]
  try {
    const keys = await kv.keys(`${PROFILE_PREFIX}*`)
    for (const key of keys.slice(0, MAX_ENTRIES)) {
      const handle = key.slice(PROFILE_PREFIX.length)
      if (!handle) continue
      entries.push({
        url: `${baseUrl}/${handle}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.8,
      })
    }
  } catch {
    // KV unavailable — fall back to just the homepage.
  }
  return entries
}
