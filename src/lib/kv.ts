import { kv } from '@vercel/kv'
import { CreatorProfile, Tip, OGMetadata, Supporter, MilestoneEvent } from './types'

const PREFIX = 'tipwall:'

export async function getProfile(handle: string): Promise<CreatorProfile | null> {
  const raw = await kv.get<CreatorProfile>(`${PREFIX}profile:${handle.toLowerCase()}`)
  return raw ?? null
}

export async function setProfile(profile: CreatorProfile): Promise<void> {
  await kv.set(`${PREFIX}profile:${profile.handle.toLowerCase()}`, profile)
}

export async function addTip(handle: string, tip: Tip): Promise<void> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  const existing = (await kv.get<Tip[]>(key)) || []
  const updated = [tip, ...existing].slice(0, 200)
  await kv.set(key, updated)
}

export async function getTips(handle: string): Promise<Tip[]> {
  const key = `${PREFIX}tips:${handle.toLowerCase()}`
  return (await kv.get<Tip[]>(key)) || []
}

export async function getSupporters(handle: string): Promise<Supporter[]> {
  // Always derive supporters from tips to ensure consistency
  const tips = await getTips(handle)
  const supportersMap = new Map<string, Supporter>()
  
  tips.forEach(tip => {
    const existing = supportersMap.get(tip.senderAddress)
    if (existing) {
      existing.totalNIM += tip.amountNIM
      existing.tipCount += 1
      existing.firstTipAt = Math.min(existing.firstTipAt, tip.timestamp)
    } else {
      supportersMap.set(tip.senderAddress, {
        address: tip.senderAddress,
        totalNIM: tip.amountNIM,
        tipCount: 1,
        firstTipAt: tip.timestamp,
      })
    }
  })
  
  return Array.from(supportersMap.values()).sort((a, b) => b.totalNIM - a.totalNIM || a.firstTipAt - b.firstTipAt)
}

export async function upsertSupporter(handle: string, tip: { senderAddress: string; amountNIM: number; timestamp: number }): Promise<void> {
  // Rebuild supporters from tips to ensure data consistency
  const tips = await getTips(handle)
  const supportersMap = new Map<string, { address: string; totalNIM: number; tipCount: number; firstTipAt: number }>()
  
  tips.forEach(t => {
    const existing = supportersMap.get(t.senderAddress)
    if (existing) {
      existing.totalNIM += t.amountNIM
      existing.tipCount += 1
      existing.firstTipAt = Math.min(existing.firstTipAt, t.timestamp)
    } else {
      supportersMap.set(t.senderAddress, {
        address: t.senderAddress,
        totalNIM: t.amountNIM,
        tipCount: 1,
        firstTipAt: t.timestamp,
      })
    }
  })
  
  const list = Array.from(supportersMap.values()).sort((a, b) => b.totalNIM - a.totalNIM || a.firstTipAt - b.firstTipAt)
  const key = `${PREFIX}supporters:${handle.toLowerCase()}`
  await kv.set(key, list)
}

export async function getMilestones(handle: string): Promise<MilestoneEvent[]> {
  const key = `${PREFIX}milestones:${handle.toLowerCase()}`
  return (await kv.get<MilestoneEvent[]>(key)) || []
}

export async function addMilestone(handle: string, event: MilestoneEvent): Promise<boolean> {
  const existing = await getMilestones(handle)
  if (existing.some(m => m.threshold === event.threshold)) return false
  const updated = [...existing, event].sort((a, b) => a.threshold - b.threshold)
  await kv.set(`${PREFIX}milestones:${handle.toLowerCase()}`, updated)
  return true
}

export async function getTotalNim(handle: string): Promise<number> {
  const tips = await getTips(handle)
  return tips.reduce((sum, t) => sum + t.amountNIM, 0)
}

export async function getOgMetadata(url: string): Promise<OGMetadata | null> {
  try {
    // Validate URL format
    try {
      new URL(url)
    } catch {
      return null
    }
    
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    clearTimeout(timeout)
    
    if (!resp.ok) return null
    
    const html = await resp.text()
    if (!html) return null
    
    const getMeta = (prop: string) => {
      const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')
      const m = html.match(re)
      return m ? m[1] : null
    }
    
    return {
      title: getMeta('og:title') || getMeta('title') || 'Untitled',
      description: getMeta('og:description') || getMeta('description') || '',
      image: getMeta('og:image') || '',
      url: getMeta('og:url') || url,
      siteName: getMeta('og:site_name') || '',
    }
  } catch (err) {
    // Log error for debugging but don't break the flow
    console.warn('Failed to fetch OG metadata:', err)
    return null
  }
}

export async function cacheOg(handle: string, meta: OGMetadata): Promise<void> {
  const profile = await getProfile(handle)
  if (!profile) return
  profile.ogCache = meta
  profile.ogCachedAt = Date.now()
  await setProfile(profile)
}
