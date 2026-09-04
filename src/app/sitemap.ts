import type { MetadataRoute } from 'next'
import { getRegisteredHandles } from '@/lib/kv'

// Served at /sitemap.xml (matching robots.txt). Must be dynamic: enumerating
// profiles needs KV, which isn't available at build time.
export const dynamic = 'force-dynamic'

const MAX_ENTRIES = 500

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Trim any trailing slash so `${baseUrl}/${handle}` can't produce `//handle`.
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://tipwall.vercel.app').replace(/\/+$/, '')
  const entries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/explore`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/launch`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ]
  try {
    const handles = await getRegisteredHandles()
    for (const handle of handles.slice(0, MAX_ENTRIES)) {
      if (!handle) continue
      entries.push({
        url: `${baseUrl}/${handle}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.8,
      })
    }
  } catch {
    // KV unavailable - fall back to just the homepage.
  }
  return entries
}
